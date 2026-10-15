import SupportArticle from '../models/SupportArticle.js'
import SupportTicket, { TICKET_STATUS } from '../models/SupportTicket.js'
import ApiError from '../utils/ApiError.js'
import {
  nextTicketCode,
  sendAttachment,
  setStatus,
  ticketFilter,
  ticketStats,
  toAttachments,
  toTicketDetail,
  toTicketSummary,
} from '../services/support.service.js'

async function findMyTicket(req) {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user._id })
  if (!ticket) throw new ApiError(404, 'Request not found')
  return ticket
}

export async function createTicket(req, res) {
  const { category, subject, description, errorCode, relatedTransaction } = req.body
  const ticket = await SupportTicket.create({
    ticketCode: await nextTicketCode(),
    user: req.user._id,
    category,
    subject,
    errorCode,
    relatedTransaction,
    messages: [{ author: 'user', body: description, attachments: toAttachments(req.files) }],
  })
  res.status(201).json({ ticket: toTicketDetail(ticket) })
}

export async function listMyTickets(req, res) {
  const { page, limit, ...filters } = req.validatedQuery
  const filter = ticketFilter(filters, { user: req.user._id })
  const [items, total] = await Promise.all([
    SupportTicket.find(filter).select('-messages').sort({ lastActivityAt: -1 }).skip((page - 1) * limit).limit(limit),
    SupportTicket.countDocuments(filter),
  ])
  res.json({ data: items.map(toTicketSummary), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function getMyTicketStats(req, res) {
  res.json(await ticketStats({ user: req.user._id }))
}

export async function getMyTicket(req, res) {
  res.json({ ticket: toTicketDetail(await findMyTicket(req)) })
}

/** The investor answers; a ticket waiting on them (or already resolved) goes back to support. */
export async function replyToTicket(req, res) {
  const ticket = await findMyTicket(req)
  ticket.messages.push({ author: 'user', body: req.body.body, attachments: toAttachments(req.files) })
  if (ticket.status === TICKET_STATUS.WAITING_FOR_USER || ticket.status === TICKET_STATUS.RESOLVED) {
    setStatus(ticket, TICKET_STATUS.IN_PROGRESS, { type: 'investor', name: req.user.fullName })
  }
  ticket.lastActivityAt = new Date()
  await ticket.save()
  res.json({ ticket: toTicketDetail(ticket) })
}

export async function getMyAttachment(req, res) {
  sendAttachment(res, await findMyTicket(req), req.params.attachmentId)
}

/** Published help articles for the "Find a Solution" tab. */
export async function listArticles(req, res) {
  const items = await SupportArticle.find({ published: true }).select('code category title summary keywords steps').sort({ code: 1 })
  res.json({ data: items.map((a) => ({ code: a.code, category: a.category, title: a.title, summary: a.summary, keywords: a.keywords, steps: a.steps })) })
}
