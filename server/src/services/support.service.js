import path from 'path'
import mongoose from 'mongoose'
import env from '../config/env.js'
import { nextSequence } from '../models/Counter.js'
import SupportTicket, { OPEN_TICKET_STATUSES, TICKET_STATUS } from '../models/SupportTicket.js'
import ApiError from '../utils/ApiError.js'

const DAY = 24 * 60 * 60 * 1000

export async function nextTicketCode() {
  const year = new Date().getFullYear()
  return `SUP-${year}-${String(await nextSequence(`support-${year}`)).padStart(6, '0')}`
}

export const toAttachments = (files = []) =>
  files.map((f) => ({ filename: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size }))

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function ticketFilter({ q, status, category, days }, base = {}) {
  return {
    ...base,
    ...(status && { status }),
    ...(category && { category }),
    ...(days && { createdAt: { $gte: new Date(Date.now() - days * DAY) } }),
    ...(q && { $or: [{ ticketCode: { $regex: escapeRegex(q), $options: 'i' } }, { subject: { $regex: escapeRegex(q), $options: 'i' } }] }),
  }
}

export async function ticketStats(match = {}) {
  const rows = await SupportTicket.aggregate([
    { $match: match.user ? { ...match, user: new mongoose.Types.ObjectId(String(match.user)) } : match },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ])
  const by = Object.fromEntries(rows.map((r) => [r._id, r.n]))
  return {
    open: OPEN_TICKET_STATUSES.reduce((sum, s) => sum + (by[s] ?? 0), 0),
    waiting: by[TICKET_STATUS.WAITING_FOR_USER] ?? 0,
    resolved: by[TICKET_STATUS.RESOLVED] ?? 0,
    byStatus: Object.fromEntries(Object.values(TICKET_STATUS).map((s) => [s, by[s] ?? 0])),
  }
}

export const toTicketSummary = (t) => ({
  id: t.id ?? String(t._id),
  ticketCode: t.ticketCode,
  subject: t.subject,
  category: t.category,
  status: t.status,
  createdAt: t.createdAt,
  lastActivityAt: t.lastActivityAt,
})

export function toTicketDetail(t) {
  return {
    ...toTicketSummary(t),
    errorCode: t.errorCode ?? null,
    relatedTransaction: t.relatedTransaction ?? null,
    resolvedAt: t.resolvedAt ?? null,
    messages: t.messages.map((m) => ({
      id: m.id,
      author: m.author,
      body: m.body,
      createdAt: m.createdAt,
      attachments: m.attachments.map((a) => ({ id: a.id, name: a.originalName, size: a.size })),
    })),
  }
}

/** Records a support-side change in the ticket's activity timeline. `actor` = { type, name }. */
export function addTicketEvent(ticket, type, from, to, actor) {
  ticket.events.push({ type, from: from ?? undefined, to: to ?? undefined, actorType: actor?.type ?? 'system', actorName: actor?.name })
}

/** Applies a status change, keeping resolvedAt in sync and logging it in the ticket's activity. */
export function setStatus(ticket, status, actor) {
  if (ticket.status !== status) addTicketEvent(ticket, 'status', ticket.status, status, actor)
  ticket.status = status
  ticket.resolvedAt = status === TICKET_STATUS.RESOLVED ? (ticket.resolvedAt ?? new Date()) : undefined
}

export function sendAttachment(res, ticket, attachmentId) {
  const attachment = ticket.messages.flatMap((m) => m.attachments).find((a) => a.id === attachmentId)
  if (!attachment) throw new ApiError(404, 'Attachment not found')
  res.set('Cache-Control', 'private, max-age=300')
  res.sendFile(path.basename(attachment.filename), { root: path.resolve(env.supportDir) })
}
