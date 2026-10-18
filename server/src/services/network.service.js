import Order, { ORDER_STATUS } from '../models/Order.js'
import User from '../models/User.js'

/**
 * Everyone below `rootId` in the referral tree, at any depth (F1, F2, F3, F4, …), with their level.
 * Deleted users are followed too: what they paid is still part of the team's sales.
 */
export async function downlineOf(rootId) {
  const [row] = await User.aggregate([
    { $match: { _id: rootId } },
    {
      $graphLookup: {
        from: 'users',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'referredBy',
        as: 'downline',
        depthField: 'depth',
      },
    },
    { $project: { 'downline._id': 1, 'downline.depth': 1 } },
  ])
  return (row?.downline ?? []).map((u) => ({ id: u._id, level: u.depth + 1 }))
}

/**
 * Team sales: USDT paid for completed purchases by the whole downline — in total, for F1/F2/F3 and for
 * everything deeper (F4+). Amounts are in cents.
 */
export async function teamSales(rootId) {
  const members = await downlineOf(rootId)
  if (!members.length) return { totalCents: 0, levelCents: [0, 0, 0], deeperCents: 0, members: 0 }
  const rows = await Order.aggregate([
    { $match: { user: { $in: members.map((m) => m.id) }, status: ORDER_STATUS.COMPLETED } },
    { $group: { _id: '$user', cents: { $sum: '$amountCents' } } },
  ])
  const paid = Object.fromEntries(rows.map((r) => [String(r._id), r.cents]))
  const levelCents = [0, 0, 0]
  let deeperCents = 0
  for (const m of members) {
    const cents = paid[String(m.id)] ?? 0
    if (m.level <= 3) levelCents[m.level - 1] += cents
    else deeperCents += cents
  }
  return { totalCents: levelCents.reduce((a, b) => a + b, 0) + deeperCents, levelCents, deeperCents, members: members.length }
}
