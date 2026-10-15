import mongoose from 'mongoose'
import Order, { ORDER_STATUS } from '../models/Order.js'
import { getSettings } from '../models/Setting.js'
import User, { ACCOUNT_STATUS, USER_STATUS } from '../models/User.js'
import WalletTransaction from '../models/WalletTransaction.js'
import { toCsv } from '../utils/csv.js'
import { fromCents } from '../utils/money.js'
import { shortName } from '../utils/privacy.js'

const MAX_LEVELS = 3 // network is shown down to F3; commission is paid on F1 only
const MAX_MEMBERS = 5000
const DAY = 24 * 60 * 60 * 1000
const RANGE_DAYS = { '7D': 7, '30D': 30, '3M': 90, '1Y': 365 }

/** Breadth-first walk of the referral tree (registered = email verified). */
async function loadNetwork(rootId) {
  const members = []
  let parents = [rootId]
  for (let level = 1; level <= MAX_LEVELS && parents.length && members.length < MAX_MEMBERS; level++) {
    const rows = await User.find({ referredBy: { $in: parents }, emailVerified: true })
      .select('fullName referredBy createdAt status accountStatus')
      .sort({ createdAt: -1 })
      .limit(MAX_MEMBERS - members.length)
      .lean()
    rows.forEach((u) => members.push({ ...u, level }))
    parents = rows.map((u) => u._id)
  }

  // Active = approved, not locked, and has at least one completed purchase
  const buyers = new Set(
    (await Order.distinct('user', { user: { $in: members.map((m) => m._id) }, status: ORDER_STATUS.COMPLETED })).map(String),
  )
  return members.map((m) => ({
    id: String(m._id),
    parentId: String(m.referredBy),
    name: shortName(m.fullName),
    level: m.level,
    joinedAt: m.createdAt,
    active: m.status === USER_STATUS.APPROVED && m.accountStatus === ACCOUNT_STATUS.ACTIVE && buyers.has(String(m._id)),
  }))
}

const commissionFilter = (userId, { q, days }) => ({
  user: new mongoose.Types.ObjectId(String(userId)),
  type: 'referral_commission',
  ...(days && { createdAt: { $gte: new Date(Date.now() - days * DAY) } }),
})

/** Commission ledger rows joined with the originating order and buyer. */
async function findCommissions(userId, filters, { skip = 0, limit = 10_000 } = {}) {
  const pipeline = [
    { $match: commissionFilter(userId, filters) },
    { $sort: { createdAt: -1 } },
    { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'order' } },
    { $unwind: '$order' },
    { $lookup: { from: 'users', localField: 'fromUser', foreignField: '_id', as: 'fromUser', pipeline: [{ $project: { fullName: 1 } }] } },
    { $unwind: { path: '$fromUser', preserveNullAndEmptyArrays: true } },
  ]
  if (filters.q) pipeline.push({ $match: { 'order.orderCode': { $regex: filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } })

  const [result] = await WalletTransaction.aggregate([
    ...pipeline,
    { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ])
  return {
    total: result.total[0]?.n ?? 0,
    items: result.items.map((t) => ({
      id: String(t._id),
      date: t.createdAt,
      member: shortName(t.fromUser?.fullName),
      orderCode: t.order.orderCode,
      level: 1,
      ratePct: t.commissionPct,
      amount: fromCents(t.amountCents),
      shares: t.order.shares,
      shareType: t.order.shareType,
    })),
  }
}

export async function getSummary(req, res) {
  const userId = req.user._id
  const [network, settings, commission, f1Orders] = await Promise.all([
    loadNetwork(userId),
    getSettings(),
    WalletTransaction.aggregate([
      { $match: { user: userId, type: 'referral_commission' } },
      { $group: { _id: null, cents: { $sum: '$amountCents' }, count: { $sum: 1 } } },
    ]),
    // Shares bought by direct referrals (the purchases that earned commission)
    Order.aggregate([
      { $match: { status: ORDER_STATUS.COMPLETED, user: { $in: await User.find({ referredBy: userId }).distinct('_id') } } },
      { $group: { _id: '$shareType', shares: { $sum: '$shares' } } },
    ]),
  ])

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const byLevel = [1, 2, 3].map((l) => network.filter((m) => m.level === l).length)
  const shares = Object.fromEntries(f1Orders.map((s) => [s._id, s.shares]))

  res.json({
    referralCode: req.user.referralCode,
    network: {
      total: network.length,
      newThisMonth: network.filter((m) => new Date(m.joinedAt) >= monthStart).length,
      active: network.filter((m) => m.active).length,
      levels: { f1: byLevel[0], f2: byLevel[1], f3: byLevel[2] },
    },
    commission: {
      total: fromCents(commission[0]?.cents ?? 0),
      count: commission[0]?.count ?? 0,
      ratePct: { A: settings.commissionPct.A, B: settings.commissionPct.B },
    },
    referralShares: { A: shares.A ?? 0, B: shares.B ?? 0, total: (shares.A ?? 0) + (shares.B ?? 0) },
  })
}

export async function getNetwork(req, res) {
  res.json({ root: { name: req.user.fullName }, members: await loadNetwork(req.user._id) })
}

export async function listCommissions(req, res) {
  const { page, limit, ...filters } = req.validatedQuery
  const { items, total } = await findCommissions(req.user._id, filters, { skip: (page - 1) * limit, limit })
  res.json({ data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function exportCommissions(req, res) {
  const { page: _p, limit: _l, ...filters } = req.validatedQuery
  const { items } = await findCommissions(req.user._id, filters)
  const csv = toCsv(
    ['Date', 'Member', 'Original transaction', 'Level', 'Commission rate (%)', 'Commission (USDT)', 'Shares', 'Class'],
    items.map((c) => [c.date.toISOString(), c.member, c.orderCode, `F${c.level}`, c.ratePct, c.amount.toFixed(2), c.shares, c.shareType]),
  )
  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="commissions-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
}

/** Daily commission totals for the performance chart, plus the previous period for comparison. */
export async function getCommissionChart(req, res) {
  const { range } = req.validatedQuery
  const userId = req.user._id
  const end = Date.now()
  let start
  if (range === 'ALL') {
    const first = await WalletTransaction.findOne({ user: userId, type: 'referral_commission' }).sort({ createdAt: 1 }).select('createdAt')
    start = Math.min(first?.createdAt.getTime() ?? end, end - 7 * DAY)
  } else {
    start = end - RANGE_DAYS[range] * DAY
  }
  const periodMs = end - start

  const [daily, previous] = await Promise.all([
    WalletTransaction.aggregate([
      { $match: { user: userId, type: 'referral_commission', createdAt: { $gte: new Date(start) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, cents: { $sum: '$amountCents' } } },
    ]),
    WalletTransaction.aggregate([
      { $match: { user: userId, type: 'referral_commission', createdAt: { $gte: new Date(start - periodMs), $lt: new Date(start) } } },
      { $group: { _id: null, cents: { $sum: '$amountCents' } } },
    ]),
  ])

  const byDay = Object.fromEntries(daily.map((d) => [d._id, d.cents]))
  const points = []
  for (let t = start; t <= end + DAY / 2; t += DAY) {
    const key = new Date(t).toISOString().slice(0, 10)
    points.push({ date: key, amount: fromCents(byDay[key] ?? 0) })
  }
  const totalCents = daily.reduce((s, d) => s + d.cents, 0)
  const previousCents = previous[0]?.cents ?? 0

  res.json({
    points,
    total: fromCents(totalCents),
    changePct: previousCents ? ((totalCents - previousCents) / previousCents) * 100 : null,
  })
}
