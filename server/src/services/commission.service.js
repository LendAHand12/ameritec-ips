import WalletTransaction, { COMMISSION_STATUS } from '../models/WalletTransaction.js'
import User, { USER_STATUS } from '../models/User.js'

/** A commission becomes spendable only when both the earner and the buyer are KYC-approved (and not deleted). */
export const isKycApproved = (user) => !!user && !user.deletedAt && user.status === USER_STATUS.APPROVED

/** The user's face scan was reviewed and approved by an admin. */
export const isFaceApproved = (user) => !!user?.faceVerified

/**
 * Moves a user's pending commissions to available once everyone involved is approved.
 * Called when an admin approves a user — as the earner (their referrals' purchases) or as the buyer.
 */
export async function releasePendingCommissions(userId) {
  const pending = await WalletTransaction.find({
    status: COMMISSION_STATUS.PENDING,
    $or: [{ user: userId }, { fromUser: userId }],
  }).select('user fromUser needsBuyerFace')
  if (!pending.length) return 0

  const ids = [...new Set(pending.flatMap((t) => [String(t.user), String(t.fromUser)]))]
  const people = await User.find({ _id: { $in: ids }, status: USER_STATUS.APPROVED, deletedAt: null }).select('_id faceVerified')
  const approved = new Set(people.map((u) => String(u._id)))
  const faceOk = new Set(people.filter((u) => u.faceVerified).map((u) => String(u._id)))
  const releasable = pending.filter(
    (t) => approved.has(String(t.user)) && approved.has(String(t.fromUser)) && (!t.needsBuyerFace || faceOk.has(String(t.fromUser))),
  )
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
