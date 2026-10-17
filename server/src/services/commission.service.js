import WalletTransaction, { COMMISSION_STATUS } from '../models/WalletTransaction.js'
import User, { USER_STATUS } from '../models/User.js'

/** The user's face scan was reviewed and approved by an admin. */
export const isFaceApproved = (user) => !!user?.faceVerified

/** A commission is held until the buyer (the referrer's downline) has an admin-approved face scan. */
export const commissionReleasable = (buyer) => !!buyer && !buyer.deletedAt && isFaceApproved(buyer)

/**
 * Moves pending commissions to available once the buyer behind them has an approved face scan.
 * Called when an admin approves a user's face scan — `userId` is the buyer (or, from older flows, the earner).
 */
export async function releasePendingCommissions(userId) {
  const pending = await WalletTransaction.find({
    status: COMMISSION_STATUS.PENDING,
    $or: [{ user: userId }, { fromUser: userId }],
  }).select('fromUser')
  if (!pending.length) return 0

  const buyers = [...new Set(pending.map((t) => String(t.fromUser)))]
  const faceOk = new Set((await User.find({ _id: { $in: buyers }, faceVerified: true, deletedAt: null }).select('_id')).map((u) => String(u._id)))
  const releasable = pending.filter((t) => faceOk.has(String(t.fromUser)))
  if (!releasable.length) return 0

  await WalletTransaction.updateMany(
    { _id: { $in: releasable.map((t) => t._id) } },
    { status: COMMISSION_STATUS.AVAILABLE, releasedAt: new Date() },
  )
  return releasable.length
}

/** One-off: commissions created before statuses existed were all paid out; keep them available for approved earners only. */
export async function migrateWallet() {
  const legacy = { status: { $exists: false } }
  const earners = await WalletTransaction.collection.distinct('user', legacy)
  if (!earners.length) return
  const approved = (await User.find({ _id: { $in: earners }, status: USER_STATUS.APPROVED }).select('_id')).map((u) => u._id)
  await WalletTransaction.collection.updateMany({ ...legacy, user: { $in: approved } }, { $set: { status: COMMISSION_STATUS.AVAILABLE } })
  await WalletTransaction.collection.updateMany(legacy, { $set: { status: COMMISSION_STATUS.PENDING } })
}

/**
 * One-off: identity documents are no longer reviewed, so accounts still waiting for that approval become active,
 * and commission that was only held for it (the buyer's face scan is already approved) is released.
 */
export async function migrateApprovals() {
  await User.updateMany({ status: USER_STATUS.PENDING }, { $set: { status: USER_STATUS.APPROVED } })
  const buyers = await WalletTransaction.distinct('fromUser', { status: COMMISSION_STATUS.PENDING })
  if (!buyers.length) return
  const faceOk = await User.find({ _id: { $in: buyers }, faceVerified: true, deletedAt: null }).distinct('_id')
  await WalletTransaction.updateMany({ status: COMMISSION_STATUS.PENDING, fromUser: { $in: faceOk } }, { status: COMMISSION_STATUS.AVAILABLE, releasedAt: new Date() })
}
