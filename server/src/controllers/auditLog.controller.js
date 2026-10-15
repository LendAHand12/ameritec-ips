import mongoose from 'mongoose'
import Admin from '../models/Admin.js'
import AuditLog, { AUDIT_ACTIONS, AUDIT_CATEGORIES, AUDIT_RECORD_TYPES } from '../models/AuditLog.js'
import ApiError from '../utils/ApiError.js'
import { toCsv } from '../utils/csv.js'

const DAY = 24 * 60 * 60 * 1000
// Read-only actions that were logged before views stopped being audited
const LEGACY_ACTIONS = {
  'user.identity_view': 'Viewed Identity Document',
  'user.export': 'Exported Users',
  'audit.export': 'Exported Audit Logs',
}
const actionLabel = (key) => AUDIT_ACTIONS[key]?.label ?? LEGACY_ACTIONS[key] ?? key
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sinceFilter = (days) => (days ? { createdAt: { $gte: new Date(Date.now() - days * DAY) } } : {})

function buildFilter({ q, category, action, admin, recordType, result, days }) {
  const rx = q && { $regex: escapeRegex(q), $options: 'i' }
  // Searching by action name ("approved") should match the action keys behind those labels
  const actionsByLabel = q ? Object.entries(AUDIT_ACTIONS).filter(([, a]) => rx && new RegExp(rx.$regex, 'i').test(a.label)).map(([k]) => k) : []
  return {
    ...sinceFilter(days),
    ...(category && { category }),
    ...(action && { action }),
    ...(admin && { admin: new mongoose.Types.ObjectId(admin) }),
    ...(recordType && { 'record.type': recordType }),
    ...(result && { result }),
    ...(rx && {
      $or: [
        { actorName: rx },
        { actorEmail: rx },
        { 'record.ref': rx },
        { 'record.id': rx },
        { description: rx },
        ...(actionsByLabel.length ? [{ action: { $in: actionsByLabel } }] : []),
      ],
    }),
  }
}

const toDto = (l) => ({
  id: l.id,
  eventCode: l.eventCode ?? null,
  createdAt: l.createdAt,
  actor: { id: l.admin ? String(l.admin) : null, name: l.actorName ?? null, email: l.actorEmail ?? null, type: l.admin ? 'admin' : 'unknown' },
  investor: l.investor?.name ? { id: l.investor.id, name: l.investor.name, ref: l.investor.ref ?? null } : null,
  category: l.category,
  categoryLabel: AUDIT_CATEGORIES[l.category] ?? (l.category === 'audit' ? 'Audit Logs' : l.category),
  action: l.action,
  actionLabel: actionLabel(l.action),
  record: l.record?.type ? { type: l.record.type, typeLabel: AUDIT_RECORD_TYPES[l.record.type], id: l.record.id, ref: l.record.ref ?? null } : null,
  description: l.description ?? null,
  changes: l.changes ?? [],
  result: l.result,
  error: l.error ?? null,
  method: l.method,
  path: l.path,
  statusCode: l.statusCode,
  ip: l.ip ?? null,
  userAgent: l.userAgent ?? null,
})

export async function listAuditLogs(req, res) {
  const { page, limit, ...filters } = req.validatedQuery
  const filter = buildFilter(filters)
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter),
  ])
  res.json({ data: items.map(toDto), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function getAuditLog(req, res) {
  const log = await AuditLog.findById(req.params.id)
  if (!log) throw new ApiError(404, 'Log entry not found')
  // Everything else that happened to the same record, oldest first
  const related = log.record?.id
    ? await AuditLog.find({ 'record.type': log.record.type, 'record.id': log.record.id }).sort({ createdAt: 1 }).limit(30)
    : [log]
  res.json({
    data: {
      ...toDto(log),
      timeline: related.map((l) => ({
        id: l.id,
        createdAt: l.createdAt,
        actionLabel: actionLabel(l.action),
        actorName: l.actorName ?? l.actorEmail ?? null,
        result: l.result,
        current: l.id === log.id,
      })),
    },
  })
}

/** Counters for the selected date range. */
export async function getAuditStats(req, res) {
  const rows = await AuditLog.aggregate([{ $match: sinceFilter(req.validatedQuery.days) }, { $group: { _id: '$category', n: { $sum: 1 } } }])
  const by = Object.fromEntries(rows.map((r) => [r._id, r.n]))
  const total = rows.reduce((s, r) => s + r.n, 0)
  res.json({ total, adminActions: total - (by.security ?? 0), security: by.security ?? 0, configuration: by.parameters ?? 0 })
}

/** Options for the filter dropdowns. */
export async function getAuditMeta(req, res) {
  const admins = await Admin.find().select('fullName email').sort({ fullName: 1 })
  res.json({
    categories: Object.entries(AUDIT_CATEGORIES).map(([value, label]) => ({ value, label })),
    actions: Object.entries(AUDIT_ACTIONS).map(([value, a]) => ({ value, label: a.label, category: a.category })),
    recordTypes: Object.entries(AUDIT_RECORD_TYPES).map(([value, label]) => ({ value, label })),
    admins: admins.map((a) => ({ value: a.id, label: a.fullName })),
  })
}

export async function exportAuditLogs(req, res) {
  const filters = req.validatedQuery
  const items = await AuditLog.find(buildFilter(filters)).sort({ createdAt: -1 }).limit(50_000)
  const csv = toCsv(
    ['Date', 'Admin', 'Admin email', 'Category', 'Action', 'Record type', 'Record', 'Description', 'Changes', 'Result', 'Error', 'IP'],
    items.map(toDto).map((l) => [
      l.createdAt.toISOString(),
      l.actor.name,
      l.actor.email,
      l.categoryLabel,
      l.actionLabel,
      l.record?.typeLabel,
      l.record?.ref ?? l.record?.id,
      l.description,
      l.changes.map((c) => `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join('; '),
      l.result,
      l.error,
      l.ip,
    ]),
  )
  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(csv)
}
