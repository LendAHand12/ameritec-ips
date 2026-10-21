import Notification, { NotificationRead } from '../models/Notification.js'
import User from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { describeAudit, investorOf } from '../services/audit.service.js'

/** Sends a message to one user or to everyone. */
export async function sendNotification(req, res) {
  const { audience, userId, title, message } = req.body
  let recipient
  if (audience === 'user') {
    recipient = await User.findOne({ _id: userId, deletedAt: null })
    if (!recipient) throw new ApiError(404, 'User not found', { userId: 'User not found' })
  }
  const notification = await Notification.create({ title, message, audience, recipient: recipient?._id, createdBy: req.admin._id })
  describeAudit(req, {
    ...(recipient && { investor: investorOf(recipient) }),
    record: { type: 'notification', id: notification.id, ref: title },
    description: audience === 'all' ? `Sent "${title}" to everyone` : `Sent "${title}" to ${recipient.fullName}`,
  })
  res.status(201).json({ data: { id: notification.id } })
}

/** Sent messages, newest first, with how many people have read each. */
export async function listSentNotifications(req, res) {
  const items = await Notification.find().sort({ createdAt: -1 }).limit(100).populate('recipient', 'fullName email').populate('createdBy', 'fullName')
  const reads = await NotificationRead.aggregate([{ $match: { notification: { $in: items.map((n) => n._id) } } }, { $group: { _id: '$notification', n: { $sum: 1 } } }])
  const readBy = Object.fromEntries(reads.map((r) => [String(r._id), r.n]))
  const everyone = await User.countDocuments({ deletedAt: null })
  res.json({
    data: items.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      audience: n.audience,
      recipient: n.recipient ? { id: n.recipient.id, fullName: n.recipient.fullName, email: n.recipient.email } : null,
      sentBy: n.createdBy?.fullName ?? null,
      createdAt: n.createdAt,
      readCount: readBy[n.id] ?? 0,
      // everyone = all current users (approximate for old announcements)
      recipients: n.audience === 'all' ? everyone : 1,
    })),
  })
}

/** Finds a user to message: by name, email, phone or referral code. */
export async function searchRecipients(req, res) {
  const q = String(req.query.q ?? '').trim()
  if (q.length < 2) return res.json({ data: [] })
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const users = await User.find({ deletedAt: null, $or: [{ fullName: rx }, { email: rx }, { phone: rx }, { referralCode: rx }] }).limit(8)
  res.json({ data: users.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, referralCode: u.referralCode })) })
}
