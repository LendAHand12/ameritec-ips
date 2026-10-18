import { getSettings } from '../models/Setting.js'
import Withdrawal, { WITHDRAWAL_STATUS } from '../models/Withdrawal.js'
import ApiError from '../utils/ApiError.js'
import { describeAudit, investorOf } from '../services/audit.service.js'
import User from '../models/User.js'
import WalletTransaction, { COMMISSION_STATUS, getBalanceCents } from '../models/WalletTransaction.js'
import { fromCents, toCents } from '../utils/money.js'

const DAY = 24 * 60 * 60 * 1000
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const COMMISSION = { type: 'referral_commission' }

const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d) // YYYY-MM-DD

/** KPIs, rates and the daily commission series for the chosen range (plus the previous period for comparison). */
export async function getSummary(req, res) {
  const { range } = req.validatedQuery
  const days = Number(range)
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0))
  const since = new Date(startOfToday.getTime() - (days - 1) * DAY)
  const previousSince = new Date(since.getTime() - days * DAY)

  const [byStatus, inRange, previous, daily, referralStats, settings, withdrawalStats] = await Promise.all([
    WalletTransaction.aggregate([{ $match: COMMISSION }, { $group: { _id: '$status', cents: { $sum: '$amountCents' }, count: { $sum: 1 } } }]),
    WalletTransaction.aggregate([{ $match: { ...COMMISSION, createdAt: { $gte: since } } }, { $group: { _id: null, cents: { $sum: '$amountCents' }, count: { $sum: 1 } } }]),
    WalletTransaction.aggregate([{ $match: { ...COMMISSION, createdAt: { $gte: previousSince, $lt: since } } }, { $group: { _id: null, cents: { $sum: '$amountCents' } } }]),
    WalletTransaction.aggregate([
      { $match: { ...COMMISSION, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } }, cents: { $sum: '$amountCents' } } },
    ]),
    User.aggregate([
      { $match: { referredBy: { $ne: null }, deletedAt: null } },
      { $group: { _id: '$referredBy', referred: { $sum: 1 } } },
      { $group: { _id: null, referrers: { $sum: 1 }, referred: { $sum: '$referred' } } },
    ]),
    getSettings(),
    Withdrawal.aggregate([{ $group: { _id: '$status', cents: { $sum: '$amountCents' }, count: { $sum: 1 } } }]),
  ])

  const sum = (status) => byStatus.find((r) => r._id === status)?.cents ?? 0
  const available = sum(COMMISSION_STATUS.AVAILABLE)
  const pending = sum(COMMISSION_STATUS.PENDING)
  const rangeCents = inRange[0]?.cents ?? 0
  const previousCents = previous[0]?.cents ?? 0

  const byDay = Object.fromEntries(daily.map((d) => [d._id, d.cents]))
  const series = Array.from({ length: days }, (_, i) => {
    const date = dayKey(new Date(since.getTime() + i * DAY + 12 * 60 * 60 * 1000))
    return { date, amount: fromCents(byDay[date] ?? 0) }
  })

  res.json({
    data: {
      total: fromCents(available + pending),
      available: fromCents(available),
      pending: fromCents(pending),
      count: byStatus.reduce((s, r) => s + r.count, 0),
      referrers: referralStats[0]?.referrers ?? 0,
      referredUsers: referralStats[0]?.referred ?? 0,
      range: {
        days,
        total: fromCents(rangeCents),
        count: inRange[0]?.count ?? 0,
        // null when the previous period had nothing to compare with
        changePct: previousCents ? ((rangeCents - previousCents) / previousCents) * 100 : null,
      },
      series,
      withdrawals: {
        pendingCount: withdrawalStats.find((w) => w._id === WITHDRAWAL_STATUS.PENDING)?.count ?? 0,
        pendingAmount: fromCents(withdrawalStats.find((w) => w._id === WITHDRAWAL_STATUS.PENDING)?.cents ?? 0),
        paidAmount: fromCents(withdrawalStats.find((w) => w._id === WITHDRAWAL_STATUS.PAID)?.cents ?? 0),
      },
      ratePct: { A: settings.commissionPct.A, B: settings.commissionPct.B },
    },
  })
}

/** Commission ledger: who earned what, from whose purchase, and whether it is withdrawable yet. */
export async function listCommissions(req, res) {
  const { page, limit, status, q, range } = req.validatedQuery
  const match = { ...COMMISSION }
  if (status) match.status = status
  if (range) match.createdAt = { $gte: new Date(Date.now() - Number(range) * DAY) }

  const pipeline = [
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'order' } },
    { $unwind: '$order' },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'earner', pipeline: [{ $project: { fullName: 1, referralCode: 1, status: 1 } }] } },
    { $unwind: { path: '$earner', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'users', localField: 'fromUser', foreignField: '_id', as: 'buyer', pipeline: [{ $project: { fullName: 1, referralCode: 1 } }] } },
    { $unwind: { path: '$buyer', preserveNullAndEmptyArrays: true } },
  ]
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' }
    pipeline.push({ $match: { $or: [{ 'order.orderCode': rx }, { 'earner.fullName': rx }, { 'earner.referralCode': rx }, { 'buyer.fullName': rx }, { 'buyer.referralCode': rx }] } })
  }

  const [result] = await WalletTransaction.aggregate([
    ...pipeline,
    { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ])
  const total = result.total[0]?.n ?? 0

  res.json({
    data: result.items.map((t) => ({
      id: String(t._id),
      date: t.createdAt,
      status: t.status ?? COMMISSION_STATUS.AVAILABLE,
      releasedAt: t.releasedAt ?? null,
      earner: t.earner && { id: String(t.earner._id), fullName: t.earner.fullName, referralCode: t.earner.referralCode, kycStatus: t.earner.status },
      buyer: t.buyer && { id: String(t.buyer._id), fullName: t.buyer.fullName, referralCode: t.buyer.referralCode },
      orderCode: t.order.orderCode,
      shareType: t.order.shareType,
      shares: t.order.shares,
      orderAmount: fromCents(t.order.amountCents),
      ratePct: t.commissionPct,
      amount: fromCents(t.amountCents),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

/** Referrers ranked by commission earned, with how many direct referrals (F1) they brought in. */
export async function listReferrers(req, res) {
  const { page, limit, q } = req.validatedQuery

  const pipeline = [
    { $match: { referredBy: { $ne: null }, deletedAt: null } },
    { $group: { _id: '$referredBy', referred: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, members: { $push: '$_id' } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user', pipeline: [{ $project: { fullName: 1, referralCode: 1, status: 1, accountStatus: 1, deletedAt: 1 } }] } },
    { $unwind: '$user' },
    { $match: { 'user.deletedAt': null } },
  ]
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' }
    pipeline.push({ $match: { $or: [{ 'user.fullName': rx }, { 'user.referralCode': rx }] } })
  }
  pipeline.push(
    {
      $lookup: {
        from: 'wallettransactions',
        localField: '_id',
        foreignField: 'user',
        as: 'ledger',
        pipeline: [{ $match: COMMISSION }, { $group: { _id: '$status', cents: { $sum: '$amountCents' } } }],
      },
    },
    // Sales: what the direct referrals (F1) have paid for completed purchases
    {
      $lookup: {
        from: 'orders',
        let: { ids: '$members' },
        pipeline: [
          { $match: { $expr: { $and: [{ $in: ['$user', '$$ids'] }, { $eq: ['$status', 'completed'] }] } } },
          { $group: { _id: null, cents: { $sum: '$amountCents' } } },
        ],
        as: 'sales',
      },
    },
    {
      $addFields: {
        directSalesCents: { $ifNull: [{ $first: '$sales.cents' }, 0] },
        availableCents: { $sum: { $map: { input: { $filter: { input: '$ledger', cond: { $ne: ['$$this._id', COMMISSION_STATUS.PENDING] } } }, in: '$$this.cents' } } },
        pendingCents: { $sum: { $map: { input: { $filter: { input: '$ledger', cond: { $eq: ['$$this._id', COMMISSION_STATUS.PENDING] } } }, in: '$$this.cents' } } },
      },
    },
    { $addFields: { totalCents: { $add: ['$availableCents', '$pendingCents'] } } },
    { $sort: { totalCents: -1, referred: -1 } },
  )

  // Team sales (all levels) is only computed for the rows on this page
  const teamSalesStages = [
    { $graphLookup: { from: 'users', startWith: '$_id', connectFromField: '_id', connectToField: 'referredBy', as: 'downline' } },
    {
      $lookup: {
        from: 'orders',
        let: { ids: { $map: { input: '$downline', as: 'd', in: '$$d._id' } } },
        pipeline: [
          { $match: { $expr: { $and: [{ $in: ['$user', '$$ids'] }, { $eq: ['$status', 'completed'] }] } } },
          { $group: { _id: null, cents: { $sum: '$amountCents' } } },
        ],
        as: 'teamSales',
      },
    },
    { $addFields: { teamSalesCents: { $ifNull: [{ $first: '$teamSales.cents' }, 0] }, teamMembers: { $size: '$downline' } } },
    { $project: { downline: 0, teamSales: 0, members: 0, ledger: 0, sales: 0 } },
  ]
  const [result] = await User.aggregate([...pipeline, { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...teamSalesStages], total: [{ $count: 'n' }] } }])
  const total = result.total[0]?.n ?? 0

  res.json({
    data: result.items.map((r) => ({
      id: String(r._id),
      fullName: r.user.fullName,
      referralCode: r.user.referralCode,
      kycStatus: r.user.status,
      accountStatus: r.user.accountStatus,
      referred: r.referred,
      referredApproved: r.approved,
      directSales: fromCents(r.directSalesCents),
      teamSales: fromCents(r.teamSalesCents ?? 0),
      teamMembers: r.teamMembers ?? 0,
      available: fromCents(r.availableCents),
      pending: fromCents(r.pendingCents),
      total: fromCents(r.totalCents),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

// ---- Withdrawals ----

const toWithdrawalDto = (w) => ({
  id: String(w._id),
  code: w.code,
  date: w.createdAt,
  amount: fromCents(w.amountCents),
  address: w.address,
  status: w.status,
  txHash: w.txHash ?? null,
  rejectionReason: w.rejectionReason ?? null,
  processedAt: w.processedAt ?? null,
  user: w.user && { id: String(w.user._id ?? w.user.id), fullName: w.user.fullName, referralCode: w.user.referralCode },
})

export async function listWithdrawals(req, res) {
  const { page, limit, status, q } = req.validatedQuery
  const match = status ? { status } : {}
  const pipeline = [
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user', pipeline: [{ $project: { fullName: 1, referralCode: 1 } }] } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  ]
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' }
    pipeline.push({ $match: { $or: [{ code: rx }, { address: rx }, { 'user.fullName': rx }, { 'user.referralCode': rx }] } })
  }
  const [result] = await Withdrawal.aggregate([...pipeline, { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } }])
  const total = result.total[0]?.n ?? 0
  res.json({ data: result.items.map(toWithdrawalDto), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

async function settle(req, res, patch, description) {
  describeAudit(req, { record: { type: 'withdrawal', id: req.params.id } })
  const withdrawal = await Withdrawal.findOneAndUpdate(
    { _id: req.params.id, status: WITHDRAWAL_STATUS.PENDING },
    { ...patch, processedAt: new Date(), processedBy: req.admin._id },
    { new: true },
  ).populate('user', 'fullName referralCode')
  if (!withdrawal) throw new ApiError(409, 'Only pending withdrawals can be processed')
  describeAudit(req, {
    investor: investorOf(withdrawal.user),
    record: { type: 'withdrawal', id: withdrawal.id, ref: withdrawal.code },
    description: description(withdrawal),
    changes: [{ field: 'Withdrawal status', from: 'pending', to: withdrawal.status }],
  })
  res.json({ data: toWithdrawalDto(withdrawal) })
}

/** The admin has sent the USDT. */
export const markWithdrawalPaid = (req, res) =>
  settle(req, res, { status: WITHDRAWAL_STATUS.PAID, txHash: req.body.txHash }, (w) => `Paid ${fromCents(w.amountCents)} USDT to ${w.address}${w.txHash ? ` (tx ${w.txHash})` : ''}`)

/** Declined: the amount goes straight back to the user's available balance. */
export const rejectWithdrawal = (req, res) =>
  settle(req, res, { status: WITHDRAWAL_STATUS.REJECTED, rejectionReason: req.body.reason }, (w) => `Rejected ${w.code}: ${w.rejectionReason}`)

// ---- Balance adjustments ----

/**
 * Adds to or deducts from a user's withdrawable commission balance. The reason is mandatory, is stored in the
 * ledger and audit log, and is shown to the user. The balance can never be pushed below zero.
 */
export async function adjustBalance(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const { direction, amount, reason } = req.body
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')
  if (user.deletedAt) throw new ApiError(409, 'This user has been deleted')

  const deltaCents = (direction === 'add' ? 1 : -1) * toCents(amount)
  const before = await getBalanceCents(user._id)
  if (before + deltaCents < 0) {
    const msg = `Can’t deduct more than the available balance (${fromCents(before).toFixed(2)} USDT)`
    throw new ApiError(400, msg, { amount: msg })
  }

  const entry = await WalletTransaction.create({
    user: user._id,
    type: 'admin_adjustment',
    amountCents: deltaCents,
    status: COMMISSION_STATUS.AVAILABLE,
    reason,
    adjustedBy: req.admin._id,
  })
  // Two admins deducting at once could both pass the check above: back this one out if we are now overdrawn
  const after = await getBalanceCents(user._id)
  if (after < 0) {
    await WalletTransaction.deleteOne({ _id: entry._id })
    throw new ApiError(409, 'The balance changed at the same time. Please check it and try again.')
  }

  describeAudit(req, {
    investor: investorOf(user),
    record: { type: 'user', id: user.id, ref: user.referralCode },
    description: `${direction === 'add' ? 'Added' : 'Deducted'} ${amount} USDT ${direction === 'add' ? 'to' : 'from'} ${user.fullName}'s balance: ${reason}`,
    changes: [{ field: 'Commission balance (USDT)', from: fromCents(before), to: fromCents(after) }],
  })
  res.status(201).json({ data: { before: fromCents(before), after: fromCents(after), change: fromCents(deltaCents) } })
}
