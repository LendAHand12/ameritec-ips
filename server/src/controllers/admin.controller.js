import path from 'path'
import env from '../config/env.js'
import Order, { ORDER_STATUS } from '../models/Order.js'
import User, { ACCOUNT_STATUS, FACE_STATUS, USER_STATUS } from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { ensureApplicationId } from '../utils/applicationId.js'
import { toCsv } from '../utils/csv.js'
import { maskPhone } from '../utils/mask.js'
import { sendAccountApprovedEmail, sendAccountRejectedEmail } from '../services/mail.service.js'
import { describeAudit, investorOf } from '../services/audit.service.js'
import { releasePendingCommissions } from '../services/commission.service.js'
import { sendFaceImage } from '../services/facetec.service.js'
import WalletTransaction, { getWalletSummary } from '../models/WalletTransaction.js'
import { getSettings } from '../models/Setting.js'
import { roundShares } from '../utils/shares.js'
import { teamSales } from '../services/network.service.js'

const userRecord = (u) => ({ type: 'user', id: u.id, ref: u.applicationId ?? u.referralCode ?? u.email })

const IMAGE_FIELDS = { front: 'frontImage', back: 'backImage', supporting: 'supportingImage' }
const DAY = 24 * 60 * 60 * 1000

// Deleted users are hidden. KYC review only concerns users who confirmed their email;
// the others are listed too (as "email not verified") so an admin can activate them by hand.
const ALL_USERS = { deletedAt: null }
const BASE_FILTER = { emailVerified: true, deletedAt: null }

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildFilter({ q, kycStatus, emailStatus, faceStatus, accountStatus, registeredWithin, submittedWithin }) {
  const filter = { ...ALL_USERS }
  if (faceStatus) filter['face.status'] = faceStatus === 'none' ? { $in: [FACE_STATUS.NONE, null] } : faceStatus
  if (emailStatus) filter.emailVerified = emailStatus === 'verified'
  // A KYC status only means something once the email is confirmed
  if (kycStatus) {
    filter.status = kycStatus
    filter.emailVerified = true
  }
  if (accountStatus) filter.accountStatus = accountStatus
  if (registeredWithin) filter.createdAt = { $gte: new Date(Date.now() - registeredWithin * DAY) }
  if (submittedWithin) filter.emailVerifiedAt = { $gte: new Date(Date.now() - submittedWithin * DAY) }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    const digits = q.replace(/\D/g, '')
    filter.$or = [
      { fullName: rx },
      { email: rx },
      { referralCode: rx },
      { applicationId: rx },
      ...(digits.length >= 3 ? [{ phone: new RegExp(escapeRegex(digits)) }] : []),
    ]
  }
  return filter
}

/** Row shown in the admin table — the email is shown in full, the phone number is masked. */
const toListItem = (u) => ({
  id: u.id,
  applicationId: u.applicationId,
  fullName: u.fullName,
  email: u.email,
  phone: maskPhone(u.phone),
  referralCode: u.referralCode,
  referredBy: u.referredBy ? { fullName: u.referredBy.fullName, referralCode: u.referredBy.referralCode } : null,
  registeredAt: u.createdAt,
  emailVerified: !!u.emailVerified,
  faceStatus: u.faceVerified ? FACE_STATUS.APPROVED : (u.face?.status ?? FACE_STATUS.NONE),
  submittedAt: u.emailVerifiedAt,
  kycStatus: u.status,
  accountStatus: u.accountStatus,
})

async function findUserOrThrow(id, { allowDeleted = false } = {}) {
  const user = await User.findById(id)
  if (!user) throw new ApiError(404, 'User not found')
  if (user.deletedAt && !allowDeleted) throw new ApiError(409, 'This user has been deleted')
  return user
}

export async function listUsers(req, res) {
  const { page, limit, ...filters } = req.validatedQuery
  const filter = buildFilter(filters)

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('referredBy', 'fullName referralCode'),
    User.countDocuments(filter),
  ])

  res.json({ data: items.map(toListItem), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function getUserStats(req, res) {
  const [byStatus, locked, unverified, facePending] = await Promise.all([
    User.aggregate([{ $match: BASE_FILTER }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ ...BASE_FILTER, accountStatus: ACCOUNT_STATUS.LOCKED }),
    User.countDocuments({ ...ALL_USERS, emailVerified: false }),
    User.countDocuments({ ...BASE_FILTER, 'face.status': FACE_STATUS.PENDING }),
  ])
  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]))
  res.json({
    data: {
      total: byStatus.reduce((sum, s) => sum + s.count, 0) + unverified,
      unverified,
      facePending,
      pending: counts[USER_STATUS.PENDING] ?? 0,
      approved: counts[USER_STATUS.APPROVED] ?? 0,
      rejected: counts[USER_STATUS.REJECTED] ?? 0,
      locked,
    },
  })
}

export async function exportUsers(req, res) {
  const { ids, ...filters } = req.validatedQuery
  const filter = ids?.length ? { ...ALL_USERS, _id: { $in: ids } } : buildFilter(filters)
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50_000).populate('referredBy', 'referralCode')

  const iso = (d) => (d ? new Date(d).toISOString() : '')
  const csv = toCsv(
    ['Application ID', 'Full name', 'Email', 'Phone', 'Referral code', 'Referred by', 'Registered', 'KYC submitted', 'Email verified', 'KYC status', 'Account status'],
    users.map((u) => [
      u.applicationId,
      u.fullName,
      u.email,
      u.phone,
      u.referralCode,
      u.referredBy?.referralCode,
      iso(u.createdAt),
      iso(u.emailVerifiedAt),
      u.emailVerified ? 'Yes' : 'No',
      u.status,
      u.accountStatus,
    ]),
  )

  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
}

/** Shares the user holds (completed orders), what they paid, current value, plus the prices/rates a manual order needs. */
async function getHoldings(userId) {
  const [settings, rows] = await Promise.all([
    getSettings(),
    Order.aggregate([
      { $match: { user: userId, status: ORDER_STATUS.COMPLETED } },
      { $group: { _id: '$shareType', shares: { $sum: '$shares' }, cents: { $sum: '$amountCents' }, orders: { $sum: 1 } } },
    ]),
  ])
  const byClass = {}
  let totalShares = 0
  let totalInvested = 0
  let totalValue = 0
  for (const t of ['A', 'B']) {
    const r = rows.find((x) => x._id === t)
    const shares = roundShares(r?.shares ?? 0)
    const price = settings.shares[t].priceCents / 100
    byClass[t] = {
      label: settings.shares[t].label,
      shares,
      orders: r?.orders ?? 0,
      invested: (r?.cents ?? 0) / 100,
      price,
      value: Math.round(shares * settings.shares[t].priceCents) / 100,
      commissionPct: settings.commissionPct[t],
    }
    totalShares += shares
    totalInvested += byClass[t].invested
    totalValue += byClass[t].value
  }
  return { ...byClass, totalShares: roundShares(totalShares), totalInvested, totalValue }
}

export async function getUser(req, res) {
  const user = await findUserOrThrow(req.params.id, { allowDeleted: true })
  await ensureApplicationId(user)
  await user.populate('referredBy', 'fullName email referralCode')
  await user.populate('reviewedBy', 'fullName email')
  const [wallet, holdings, adjustments] = await Promise.all([
    getWalletSummary(user._id),
    getHoldings(user._id),
    WalletTransaction.find({ user: user._id, type: 'admin_adjustment' }).sort({ createdAt: -1 }).limit(5).populate('adjustedBy', 'fullName'),
  ])
  res.json({
    data: {
      ...user.toJSON(),
      // Commission wallet, in USDT: what they can withdraw, what waits for KYC approval, what's been paid out
      holdings,
      wallet: {
        available: wallet.availableCents / 100,
        pending: wallet.pendingCents / 100,
        requested: wallet.requestedCents / 100,
        withdrawn: wallet.withdrawnCents / 100,
        earned: wallet.earnedCents / 100,
        adjusted: wallet.adjustmentCents / 100,
        adjustments: adjustments.map((a) => ({ id: a.id, amount: a.amountCents / 100, reason: a.reason, by: a.adjustedBy?.fullName ?? null, date: a.createdAt })),
        address: user.withdrawalWallet?.address ?? null,
      },
    },
  })
}

export async function getIdentityImage(req, res) {
  const { id, side } = req.params
  if (!IMAGE_FIELDS[side] && side !== 'face') throw new ApiError(404, 'Image not found')

  const user = await findUserOrThrow(id, { allowDeleted: true })
  if (side === 'face') return sendFaceImage(res, user)
  const filename = user.identity?.[IMAGE_FIELDS[side]]
  if (!filename) throw new ApiError(404, 'Image not found')

  res.set('Cache-Control', 'private, no-store')
  res.sendFile(path.basename(filename), { root: path.resolve(env.kyc.dir) })
}

export async function approveUser(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)
  describeAudit(req, { investor: investorOf(user), record: userRecord(user), description: `Identity verification approved for ${user.fullName}`, changes: [{ field: 'KYC status', from: user.status, to: USER_STATUS.APPROVED }] })
  if (!user.emailVerified) throw new ApiError(400, 'User has not verified their email yet')

  user.status = USER_STATUS.APPROVED
  user.rejectionReason = undefined
  user.reviewedAt = new Date()
  user.reviewedBy = req.admin._id
  await user.save()
  // Commissions this user earned (or generated) while unapproved become withdrawable now
  const released = await releasePendingCommissions(user._id)
  if (released) describeAudit(req, { description: `Identity verification approved for ${user.fullName}; released ${released} pending commission(s)` })

  sendAccountApprovedEmail(user).catch((err) => console.error('Failed to send approval email:', err.message))
  res.json({ data: user })
}

export async function rejectUser(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)
  describeAudit(req, { investor: investorOf(user), record: userRecord(user), description: `Rejected: ${req.body.reason}`, changes: [{ field: 'KYC status', from: user.status, to: USER_STATUS.REJECTED }] })

  user.status = USER_STATUS.REJECTED
  user.rejectionReason = req.body.reason
  user.reviewedAt = new Date()
  user.reviewedBy = req.admin._id
  await user.save()

  sendAccountRejectedEmail(user).catch((err) => console.error('Failed to send rejection email:', err.message))
  res.json({ data: user })
}

export async function lockUser(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)
  describeAudit(req, { investor: investorOf(user), record: userRecord(user), description: `Locked: ${req.body.reason}` })
  user.accountStatus = ACCOUNT_STATUS.LOCKED
  user.lockedAt = new Date()
  user.lockedReason = req.body.reason
  await user.save()
  res.json({ data: user })
}

export async function unlockUser(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)
  describeAudit(req, { investor: investorOf(user), record: userRecord(user), description: `Account of ${user.fullName} unlocked` })
  user.accountStatus = ACCOUNT_STATUS.ACTIVE
  user.lockedAt = undefined
  user.lockedReason = undefined
  await user.save()
  res.json({ data: user })
}

const referrerLabel = (u) => (u ? `${u.fullName} (${u.referralCode})` : 'None')

/** Re-parents a user in the referral tree. Commissions already paid stay with the previous referrer. */
export async function changeReferrer(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)
  const { referralCode } = req.body

  const previous = user.referredBy ? await User.findById(user.referredBy).select('fullName referralCode') : null
  let next = null
  if (referralCode) {
    next = await User.findOne({ referralCode, deletedAt: null }).select('fullName referralCode referredBy')
    if (!next) throw new ApiError(404, 'Referral code does not exist', { referralCode: 'Referral code does not exist' })
    if (next.id === user.id) throw new ApiError(400, 'A user cannot be their own referrer', { referralCode: 'Cannot refer themselves' })

    // The new referrer must not already sit below this user, or the tree would loop
    let cursor = next.referredBy
    for (let hops = 0; cursor && hops < 1000; hops++) {
      if (String(cursor) === user.id) {
        throw new ApiError(409, 'This user is already above the new referrer in the network', { referralCode: 'Would create a referral loop' })
      }
      cursor = (await User.findById(cursor).select('referredBy'))?.referredBy
    }
  }
  if (String(previous?._id ?? '') === String(next?._id ?? '')) throw new ApiError(400, 'The user already has this referrer', { referralCode: 'No change' })

  user.referredBy = next?._id ?? null
  await user.save()

  describeAudit(req, {
    investor: investorOf(user),
    record: userRecord(user),
    description: `Referrer changed: ${referrerLabel(previous)} → ${referrerLabel(next)}`,
    changes: [{ field: 'Referred by', from: referrerLabel(previous), to: referrerLabel(next) }],
  })
  await user.populate('referredBy', 'fullName email referralCode')
  res.json({ data: user })
}

/**
 * Soft delete. The account can no longer sign in or appear in lists, and its email, phone and
 * unfinished-payment transaction hashes are released so a new account can use them again.
 */
export async function deleteUser(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)

  const waiting = await Order.countDocuments({ user: user._id, status: { $in: [ORDER_STATUS.VERIFYING, ORDER_STATUS.PENDING_REVIEW] } })
  if (waiting) {
    throw new ApiError(409, `This user has ${waiting} order(s) waiting for payment review. Approve or reject them before deleting the user.`)
  }
  describeAudit(req, {
    investor: investorOf(user),
    record: userRecord(user),
    description: `Deleted ${user.fullName}${req.body.reason ? `: ${req.body.reason}` : ''}`,
    changes: [{ field: 'Account', from: 'Active', to: 'Deleted' }],
  })

  // Unpaid orders are cancelled; unfinished orders give their tx hash back. Completed orders keep it
  // so a payment that already bought shares can never be claimed twice.
  await Order.updateMany({ user: user._id, status: { $in: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.PAYING] } }, { status: ORDER_STATUS.CANCELLED })
  await Order.updateMany({ user: user._id, status: { $ne: ORDER_STATUS.COMPLETED }, txHash: { $exists: true } }, [
    { $set: { releasedTxHash: '$txHash' } },
    { $unset: 'txHash' },
  ])

  user.deletedSnapshot = {
    email: user.email,
    phone: user.phone,
    applicationId: user.applicationId,
    referralCode: user.referralCode,
    reason: req.body.reason,
  }
  user.email = `deleted+${user.id}@deleted.invalid`
  user.phone = `deleted:${user.id}`
  user.deletedAt = new Date()
  user.deletedBy = req.admin._id
  await user.save()

  res.json({ data: user })
}

/** Activates an account whose verification email never arrived. KYC review is still needed afterwards. */
export async function verifyUserEmail(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)
  if (user.emailVerified) throw new ApiError(409, 'This user has already verified their email')
  describeAudit(req, {
    investor: investorOf(user),
    record: userRecord(user),
    description: `Email of ${user.fullName} verified manually by an admin`,
    changes: [{ field: 'Email verified', from: 'No', to: 'Yes' }],
  })

  user.emailVerified = true
  user.emailVerifiedAt = new Date()
  user.emailVerification = undefined
  await user.save()
  res.json({ data: user })
}

/** Approves the face scan: the account becomes face-verified and commission held back for it is released. */
export async function approveFace(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)
  if (user.face?.status !== FACE_STATUS.PENDING) throw new ApiError(409, 'There is no face scan waiting for review')
  describeAudit(req, {
    investor: investorOf(user),
    record: userRecord(user),
    description: `Face scan of ${user.fullName} approved`,
    changes: [{ field: 'Face scan', from: user.face.status, to: FACE_STATUS.APPROVED }],
  })

  user.face.status = FACE_STATUS.APPROVED
  user.face.reviewedAt = new Date()
  user.face.reviewedBy = req.admin._id
  user.face.rejectionReason = undefined
  user.faceVerified = true
  await user.save()
  // Referrers' commission from this user's purchases was waiting for exactly this
  const released = await releasePendingCommissions(user._id)
  if (released) describeAudit(req, { description: `Face scan of ${user.fullName} approved; released ${released} pending commission(s)` })
  res.json({ data: user })
}

export async function rejectFace(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const user = await findUserOrThrow(req.params.id)
  if (user.face?.status !== FACE_STATUS.PENDING) throw new ApiError(409, 'There is no face scan waiting for review')
  describeAudit(req, {
    investor: investorOf(user),
    record: userRecord(user),
    description: `Face scan of ${user.fullName} rejected: ${req.body.reason}`,
    changes: [{ field: 'Face scan', from: user.face.status, to: FACE_STATUS.REJECTED }],
  })

  user.face.status = FACE_STATUS.REJECTED
  user.face.reviewedAt = new Date()
  user.face.reviewedBy = req.admin._id
  user.face.rejectionReason = req.body.reason
  user.faceVerified = false
  await user.save()
  res.json({ data: user })
}

const NETWORK_LEVELS = 3 // same depth the investor sees: F1 – F3
const NETWORK_MAX_MEMBERS = 2000

/** A user's downline down to F3, with what each member bought and the commission F1 purchases earned the user. */
export async function getUserNetwork(req, res) {
  const root = await findUserOrThrow(req.params.id, { allowDeleted: true })

  const members = []
  let parents = [root._id]
  for (let level = 1; level <= NETWORK_LEVELS && parents.length && members.length < NETWORK_MAX_MEMBERS; level++) {
    const rows = await User.find({ referredBy: { $in: parents }, deletedAt: null })
      .select('fullName referralCode referredBy createdAt status accountStatus emailVerified faceVerified face.status')
      .sort({ createdAt: -1 })
      .limit(NETWORK_MAX_MEMBERS - members.length)
      .lean()
    rows.forEach((u) => members.push({ ...u, level }))
    parents = rows.map((u) => u._id)
  }

  const ids = members.map((m) => m._id)
  const [sales, orders, commissions] = await Promise.all([
    teamSales(root._id), // the whole downline, however deep, not just the F1–F3 listed below
    Order.aggregate([
      { $match: { user: { $in: ids }, status: ORDER_STATUS.COMPLETED } },
      { $group: { _id: '$user', cents: { $sum: '$amountCents' }, count: { $sum: 1 } } },
    ]),
    // Commission is paid on F1 purchases only: what each direct referral earned this user
    WalletTransaction.aggregate([
      { $match: { user: root._id, type: 'referral_commission', fromUser: { $in: ids } } },
      { $group: { _id: { buyer: '$fromUser', status: '$status' }, cents: { $sum: '$amountCents' } } },
    ]),
  ])
  const bought = Object.fromEntries(orders.map((o) => [String(o._id), o]))
  const earned = {}
  for (const c of commissions) {
    const key = String(c._id.buyer)
    earned[key] ??= { available: 0, pending: 0 }
    earned[key][(c._id.status ?? 'available') === 'pending' ? 'pending' : 'available'] += c.cents
  }

  const items = members.map((m) => ({
    id: String(m._id),
    parentId: String(m.referredBy),
    level: m.level,
    fullName: m.fullName,
    referralCode: m.referralCode,
    joinedAt: m.createdAt,
    kycStatus: m.status,
    accountStatus: m.accountStatus,
    emailVerified: !!m.emailVerified,
    faceStatus: m.faceVerified ? FACE_STATUS.APPROVED : (m.face?.status ?? FACE_STATUS.NONE),
    purchases: bought[String(m._id)]?.count ?? 0,
    purchased: (bought[String(m._id)]?.cents ?? 0) / 100,
    commission: m.level === 1 ? { available: (earned[String(m._id)]?.available ?? 0) / 100, pending: (earned[String(m._id)]?.pending ?? 0) / 100 } : null,
  }))

  res.json({
    data: {
      root: { id: root.id, fullName: root.fullName, referralCode: root.referralCode },
      members: items,
      summary: {
        total: items.length,
        levels: [1, 2, 3].map((l) => items.filter((m) => m.level === l).length),
        buyers: items.filter((m) => m.purchases > 0).length,
        // Team sales: USDT the whole downline has paid (all levels), per level for F1–F3 and for F4 and deeper
        purchased: sales.totalCents / 100,
        purchasedByLevel: sales.levelCents.map((c) => c / 100),
        purchasedDeeper: sales.deeperCents / 100,
        downlineTotal: sales.members,
        truncated: items.length >= NETWORK_MAX_MEMBERS,
      },
    },
  })
}
