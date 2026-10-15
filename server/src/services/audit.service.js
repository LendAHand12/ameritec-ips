import AuditLog, { AUDIT_ACTIONS } from '../models/AuditLog.js'
import { nextSequence } from '../models/Counter.js'

// Only requests that change something are audited; viewing and exporting data is not
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Route middleware: declares which audit action a request performs. */
export const auditAction = (action) => (req, res, next) => {
  req.audit = { ...req.audit, action }
  next()
}

/** Investor summary for the audit entry (from a user document or a populated `user` field). */
export const investorOf = (u) => (u?.fullName ? { id: String(u._id ?? u.id), name: u.fullName, ref: u.referralCode } : undefined)

/** Lets a controller attach details (record, description, before/after changes) to the request's audit entry. */
export function describeAudit(req, details) {
  req.audit = { ...req.audit, ...details, ...(details.record && { record: { ...req.audit?.record, ...details.record } }) }
}

/** Field-by-field diff of two flat objects: [{ field, from, to }] for values that changed. */
export function diff(before, after, labels = {}) {
  return Object.keys(after)
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ field: labels[k] ?? k, from: before[k] ?? null, to: after[k] ?? null }))
}

const fmt = (v) => (v === true ? 'On' : v === false ? 'Off' : v == null || v === '' ? '—' : String(v))
export const summarizeChanges = (changes, max = 2) =>
  changes.length
    ? changes
        .slice(0, max)
        .map((c) => `${c.field}: ${fmt(c.from)} → ${fmt(c.to)}`)
        .join('; ') + (changes.length > max ? ` (+${changes.length - max} more)` : '')
    : 'No changes'

/**
 * Writes one audit entry per admin request once the response is sent — success or failure.
 * Mutating requests without a declared action are still logged as "Other Admin Action".
 */
export function auditTrail(req, res, next) {
  res.on('finish', () => {
    const audit = req.audit
    if (audit?.skip || !MUTATING.has(req.method)) return
    const action = audit?.action ?? 'admin.request'
    const failed = res.statusCode >= 400
    const actor = req.admin ?? audit?.actor
    writeEntry({
      admin: actor?._id,
      actorName: actor?.fullName,
      actorEmail: actor?.email ?? audit?.actorEmail,
      category: AUDIT_ACTIONS[action].category,
      action,
      record: audit?.record,
      investor: audit?.investor,
      description: audit?.description ?? (action === 'admin.request' ? `${req.method} ${req.originalUrl}` : undefined),
      changes: audit?.changes,
      result: failed ? 'failure' : 'success',
      error: failed ? (res.locals.errorMessage ?? `HTTP ${res.statusCode}`) : undefined,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 300),
    })
  })
  next()
}

async function writeEntry(entry) {
  try {
    const year = new Date().getFullYear()
    const eventCode = `AUD-${year}-${String(await nextSequence(`audit-${year}`)).padStart(6, '0')}`
    await AuditLog.create({ ...entry, eventCode })
  } catch (err) {
    // Never break the admin's request because of logging, but make the gap visible
    console.error('Failed to write audit log:', err.message, entry.action)
  }
}
