import mongoose from 'mongoose'

export const AUDIT_CATEGORIES = {
  users: 'Users & KYC',
  transactions: 'Transactions',
  referrals: 'Referral & Commission',
  parameters: 'Operational Parameters',
  support: 'Support',
  security: 'Security',
  other: 'Other',
}

export const AUDIT_RECORD_TYPES = {
  user: 'Investor',
  order: 'Order',
  settings: 'Settings',
  ticket: 'Support Ticket',
  article: 'Help Article',
  admin: 'Admin Account',
  withdrawal: 'Withdrawal',
}

/** Every admin action, by key. Category drives the dashboard counters. */
export const AUDIT_ACTIONS = {
  'admin.login': { category: 'security', label: 'Signed In' },
  'admin.login_failed': { category: 'security', label: 'Failed Sign-in' },
  'admin.logout': { category: 'security', label: 'Signed Out' },
  'user.approve': { category: 'users', label: 'Approved KYC' },
  'user.reject': { category: 'users', label: 'Rejected KYC' },
  'user.lock': { category: 'users', label: 'Locked Account' },
  'user.unlock': { category: 'users', label: 'Unlocked Account' },
  'user.verify_email': { category: 'users', label: 'Verified Email Manually' },
  'user.face_approve': { category: 'users', label: 'Approved Face Scan' },
  'user.face_reject': { category: 'users', label: 'Rejected Face Scan' },
  'user.change_referrer': { category: 'users', label: 'Changed Referrer' },
  'user.delete': { category: 'users', label: 'Deleted User' },
  'order.approve': { category: 'transactions', label: 'Approved Payment' },
  'order.reject': { category: 'transactions', label: 'Rejected Payment' },
  'order.manual': { category: 'transactions', label: 'Created Order Manually' },
  'order.certificate_upload': { category: 'transactions', label: 'Uploaded Certificate' },
  'settings.update': { category: 'parameters', label: 'Updated Parameters' },
  'settings.zelle_qr': { category: 'parameters', label: 'Updated Zelle QR Code' },
  'ticket.reply': { category: 'support', label: 'Replied to Ticket' },
  'ticket.update': { category: 'support', label: 'Updated Ticket' },
  'ticket.note': { category: 'support', label: 'Added Internal Note' },
  'ticket.escalate': { category: 'support', label: 'Escalated Ticket' },
  'article.create': { category: 'support', label: 'Created Help Article' },
  'article.update': { category: 'support', label: 'Updated Help Article' },
  'article.delete': { category: 'support', label: 'Deleted Help Article' },
  'admin.create': { category: 'security', label: 'Created Admin Account' },
  'admin.update': { category: 'security', label: 'Updated Admin Account' },
  'admin.password_reset': { category: 'security', label: 'Reset Admin Password' },
  'admin.2fa_enable': { category: 'security', label: 'Turned On Two-Factor' },
  'admin.2fa_disable': { category: 'security', label: 'Turned Off Two-Factor' },
  'admin.role_create': { category: 'security', label: 'Created Admin Role' },
  'admin.role_update': { category: 'security', label: 'Updated Admin Role' },
  'admin.role_delete': { category: 'security', label: 'Deleted Admin Role' },
  'wallet.adjust': { category: 'referrals', label: 'Adjusted Balance' },
  'withdrawal.paid': { category: 'referrals', label: 'Marked Withdrawal Paid' },
  'withdrawal.reject': { category: 'referrals', label: 'Rejected Withdrawal' },
  'admin.request': { category: 'other', label: 'Other Admin Action' },
}

const changeSchema = new mongoose.Schema({ field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed }, { _id: false })

/** Append-only record of admin activity. There is deliberately no API to edit or delete entries. */
const auditLogSchema = new mongoose.Schema(
  {
    eventCode: { type: String, unique: true, sparse: true }, // AUD-2026-000001
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', index: true },
    // Snapshot so the log still reads correctly if the admin is renamed or removed
    actorName: String,
    actorEmail: String,
    category: { type: String, enum: Object.keys(AUDIT_CATEGORIES), required: true, index: true },
    action: { type: String, enum: Object.keys(AUDIT_ACTIONS), required: true, index: true },
    record: {
      type: { type: String, enum: Object.keys(AUDIT_RECORD_TYPES) },
      id: String,
      ref: String, // human reference: order code, ticket code, application ID…
    },
    // The investor the record belongs to, when there is one
    investor: { id: String, name: String, ref: String },
    description: String,
    changes: [changeSchema],
    result: { type: String, enum: ['success', 'failure'], required: true, index: true },
    error: String,
    method: String,
    path: String,
    statusCode: Number,
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditLogSchema.index({ createdAt: -1 })

export default mongoose.model('AuditLog', auditLogSchema)
