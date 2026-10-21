import Notification, { NotificationRead } from '../models/Notification.js'

/** What a user can see: messages sent to them, and announcements sent to everyone since they joined. */
const visibleTo = (user) => ({
  $or: [{ recipient: user._id }, { audience: 'all', createdAt: { $gte: user.createdAt } }],
})

export async function listMyNotifications(req, res) {
  const filter = visibleTo(req.user)
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(30)
  const reads = await NotificationRead.find({ user: req.user._id, notification: { $in: items.map((n) => n._id) } })
  const readIds = new Set(reads.map((r) => String(r.notification)))
  const data = items.map((n) => ({ id: n.id, title: n.title, message: n.message, createdAt: n.createdAt, read: readIds.has(n.id) }))
  // Unread across everything visible, not just the 30 shown
  const [visible, readCount] = await Promise.all([
    Notification.countDocuments(filter),
    NotificationRead.countDocuments({ user: req.user._id, notification: { $in: await Notification.find(filter).distinct('_id') } }),
  ])
  res.json({ data, unread: Math.max(0, visible - readCount) })
}

/** Marks the given notifications (or every visible one when `all`) as read. */
export async function markNotificationsRead(req, res) {
  const { ids, all } = req.body
  const filter = visibleTo(req.user)
  const target = all ? await Notification.find(filter).distinct('_id') : await Notification.find({ ...filter, _id: { $in: ids } }).distinct('_id')
  if (target.length) {
    await NotificationRead.bulkWrite(
      target.map((id) => ({ updateOne: { filter: { user: req.user._id, notification: id }, update: { $setOnInsert: { readAt: new Date() } }, upsert: true } })),
      { ordered: false },
    )
  }
  res.json({ ok: true })
}
