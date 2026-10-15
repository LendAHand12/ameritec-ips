import path from 'path'
import env from '../config/env.js'
import User, { ACCOUNT_STATUS, USER_STATUS } from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { ensureApplicationId } from '../utils/applicationId.js'
import { toCsv } from '../utils/csv.js'
import { maskEmail, maskPhone } from '../utils/mask.js'
import { sendAccountApprovedEmail, sendAccountRejectedEmail } from '../services/mail.service.js'
import { describeAudit, investorOf } from '../services/audit.service.js'

const userRecord = (u) => ({ type: 'user', id: u.id, ref: u.applicationId ?? u.referralCode ?? u.email })

const IMAGE_FIELDS = { front: 'frontImage', back: 'backImage', supporting: 'supportingImage' }
const DAY = 24 * 60 * 60 * 1000

// Only finished registrations (email confirmed) reach the admin queue
const BASE_FILTER = { emailVerified: true }

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildFilter({ q, kycStatus, accountStatus, registeredWithin, submittedWithin }) {
  const filter = { ...BASE_FILTER }
  if (kycStatus) filter.status = kycStatus
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

/** Row shown in the admin table — contact details are masked. */
const toListItem = (u) => ({
  id: u.id,
  applicationId: u.applicationId,
  fullName: u.fullName,
  email: maskEmail(u.email),
  phone: maskPhone(u.phone),
  referralCode: u.referralCode,
  referredBy: u.referredBy ? { fullName: u.referredBy.fullName, referralCode: u.referredBy.referralCode } : null,
  registeredAt: u.createdAt,
  submittedAt: u.emailVerifiedAt,
  kycStatus: u.status,
  accountStatus: u.accountStatus,
})

async function findUserOrThrow(id) {
  const user = await User.findById(id)
  if (!user) throw new ApiError(404, 'User not found')
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
  const [byStatus, locked] = await Promise.all([
    User.aggregate([{ $match: BASE_FILTER }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ ...BASE_FILTER, accountStatus: ACCOUNT_STATUS.LOCKED }),
  ])
  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]))
  res.json({
    data: {
      total: byStatus.reduce((sum, s) => sum + s.count, 0),
      pending: counts[USER_STATUS.PENDING] ?? 0,
      approved: counts[USER_STATUS.APPROVED] ?? 0,
      rejected: counts[USER_STATUS.REJECTED] ?? 0,
      locked,
    },
  })
}

export async function exportUsers(req, res) {
  const { ids, ...filters } = req.validatedQuery
  const filter = ids?.length ? { ...BASE_FILTER, _id: { $in: ids } } : buildFilter(filters)
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50_000).populate('referredBy', 'referralCode')

  const iso = (d) => (d ? new Date(d).toISOString() : '')
  const csv = toCsv(
    ['Application ID', 'Full name', 'Email', 'Phone', 'Referral code', 'Referred by', 'Registered', 'KYC submitted', 'KYC status', 'Account status'],
    users.map((u) => [
      u.applicationId,
      u.fullName,
      u.email,
      u.phone,
      u.referralCode,
      u.referredBy?.referralCode,
      iso(u.createdAt),
      iso(u.emailVerifiedAt),
      u.status,
      u.accountStatus,
    ]),
  )

  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
}

export async function getUser(req, res) {
  const user = await findUserOrThrow(req.params.id)
  await ensureApplicationId(user)
  await user.populate('referredBy', 'fullName email referralCode')
  await user.populate('reviewedBy', 'fullName email')
  res.json({ data: user })
}

export async function getIdentityImage(req, res) {
  const { id, side } = req.params
  if (!IMAGE_FIELDS[side]) throw new ApiError(404, 'Image not found')

  const user = await findUserOrThrow(id)
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
