import mongoose from 'mongoose'
import Admin from '../models/Admin.js'
import SupportArticle from '../models/SupportArticle.js'
import Order from '../models/Order.js'
import SupportTicket, { TICKET_CATEGORIES, TICKET_STATUS } from '../models/SupportTicket.js'
import User from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { fromCents } from '../utils/money.js'
import { maskEmail } from '../utils/mask.js'
import { describeAudit, diff, investorOf, summarizeChanges } from '../services/audit.service.js'
import { addTicketEvent, sendAttachment, setStatus, ticketFilter, toAttachments, toTicketDetail, toTicketSummary } from '../services/support.service.js'

const DAY = 24 * 60 * 60 * 1000
const METRICS_DAYS = 30
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const userDto = (u) => (u ? { id: u.id ?? String(u._id), fullName: u.fullName, email: u.email, referralCode: u.referralCode } : null)
const agentDto = (a) => (a ? { id: a.id ?? String(a._id), fullName: a.fullName } : null)
const POPULATE_USER = ['user', 'fullName email referralCode status accountStatus']
const POPULATE_AGENT = ['assignedTo', 'fullName']

const adminTicketDto = (t) => ({
  ...toTicketDetail(t),
  priority: t.priority,
  user: userDto(t.user),
  assignedTo: agentDto(t.assignedTo),
  firstResponseAt: t.firstResponseAt ?? null,
  escalatedAt: t.escalatedAt ?? null,
})

const adminActor = (req) => ({ type: 'admin', name: req.admin.fullName })

/** Full admin view: author names, internal notes, activity, investor and linked order. */
async function adminTicketDetail(t) {
  const adminIds = [...t.messages.map((m) => m.admin), ...t.notes.map((n) => n.admin)].filter(Boolean)
  const [admins, order] = await Promise.all([
    Admin.find({ _id: { $in: adminIds } }).select('fullName'),
    t.relatedTransaction ? Order.findOne({ orderCode: t.relatedTransaction, user: t.user?._id }) : null,
  ])
  const adminName = (id) => admins.find((a) => a._id.equals(id))?.fullName ?? 'Support'
  const base = adminTicketDto(t)
  return {
    ...base,
    messages: base.messages.map((m, i) => ({
      ...m,
      authorName: m.author === 'admin' ? adminName(t.messages[i].admin) : (t.user?.fullName ?? 'Investor'),
    })),
    notes: t.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt, authorName: adminName(n.admin) })),
    activity: [
      { id: 'created', type: 'created', actorType: 'investor', actorName: t.user?.fullName ?? null, createdAt: t.createdAt },
      ...t.events.map((e) => ({ id: e.id, type: e.type, from: e.from ?? null, to: e.to ?? null, actorType: e.actorType, actorName: e.actorName ?? null, createdAt: e.createdAt })),
    ].reverse(),
    investor: t.user
      ? {
          id: t.user.id,
          fullName: t.user.fullName,
          referralCode: t.user.referralCode,
          kycStatus: t.user.status,
          accountStatus: t.user.accountStatus,
          maskedEmail: maskEmail(t.user.email),
        }
      : null,
    relatedOrder: order
      ? { id: order.id, orderCode: order.orderCode, amount: fromCents(order.amountCents), shareType: order.shareType, shares: order.shares, status: order.status }
      : null,
  }
}

async function findTicket(req) {
  const ticket = await SupportTicket.findById(req.params.id).populate(...POPULATE_USER).populate(...POPULATE_AGENT)
  if (!ticket) throw new ApiError(404, 'Ticket not found')
  return ticket
}

/** Free-text search also matches the investor (name, email, referral code, application ID). */
async function buildFilter(req) {
  const { q, status, category, days, priority, assignee, scope } = req.validatedQuery
  const filter = ticketFilter({ status, category, days })
  if (priority) filter.priority = priority
  const assigneeConditions = []
  if (assignee) assigneeConditions.push({ assignedTo: new mongoose.Types.ObjectId(assignee) })
  if (scope === 'mine') assigneeConditions.push({ assignedTo: req.admin._id })
  if (scope === 'unassigned') assigneeConditions.push({ assignedTo: null })
  if (assigneeConditions.length) filter.$and = assigneeConditions
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' }
    const users = await User.find({ $or: [{ fullName: rx }, { email: rx }, { referralCode: rx }, { applicationId: rx }] })
      .limit(500)
      .distinct('_id')
    filter.$or = [{ ticketCode: rx }, { subject: rx }, { relatedTransaction: rx }, { errorCode: rx }, { user: { $in: users } }]
  }
  return filter
}

export async function listTickets(req, res) {
  const { page, limit } = req.validatedQuery
  const filter = await buildFilter(req)
  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .select('-messages')
      .populate(...POPULATE_USER)
      .populate(...POPULATE_AGENT)
      .sort({ lastActivityAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SupportTicket.countDocuments(filter),
  ])
  res.json({
    data: items.map((t) => ({
      ...toTicketSummary(t),
      priority: t.priority,
      relatedTransaction: t.relatedTransaction ?? null,
      user: userDto(t.user),
      assignedTo: agentDto(t.assignedTo),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

/** Inbox counters, response-time averages (last 30 days) and the analytics breakdowns. */
export async function getTicketStats(req, res) {
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0))
  const since = new Date(startOfToday.getTime() - (METRICS_DAYS - 1) * DAY)
  const [byStatusRows, byCategoryRows, resolvedToday, [times = {}], volumeRows] = await Promise.all([
    SupportTicket.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    SupportTicket.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]),
    SupportTicket.countDocuments({ resolvedAt: { $gte: startOfToday } }),
    SupportTicket.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          firstResponseMs: { $avg: { $cond: [{ $ifNull: ['$firstResponseAt', false] }, { $subtract: ['$firstResponseAt', '$createdAt'] }, null] } },
          resolutionMs: { $avg: { $cond: [{ $ifNull: ['$resolvedAt', false] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } },
        },
      },
    ]),
    SupportTicket.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } }, n: { $sum: 1 } } },
    ]),
  ])

  const byStatus = Object.fromEntries(Object.values(TICKET_STATUS).map((s) => [s, byStatusRows.find((r) => r._id === s)?.n ?? 0]))
  const counts = Object.fromEntries(volumeRows.map((r) => [r._id, r.n]))
  const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d) // YYYY-MM-DD
  const volume = Array.from({ length: METRICS_DAYS }, (_, i) => {
    const date = dayKey(new Date(since.getTime() + i * DAY + 12 * 60 * 60 * 1000))
    return { date, count: counts[date] ?? 0 }
  })

  res.json({
    open: byStatus.received + byStatus.in_progress + byStatus.waiting_for_user,
    new: byStatus.received,
    inProgress: byStatus.in_progress,
    waiting: byStatus.waiting_for_user,
    resolvedToday,
    // Tickets that need something from support (sidebar badge)
    needsAttention: byStatus.received + byStatus.in_progress,
    avgFirstResponseMs: times.firstResponseMs ?? null,
    avgResolutionMs: times.resolutionMs ?? null,
    metricsDays: METRICS_DAYS,
    byStatus,
    byCategory: Object.fromEntries(TICKET_CATEGORIES.map((c) => [c, byCategoryRows.find((r) => r._id === c)?.n ?? 0])),
    volume,
  })
}

export async function listAgents(req, res) {
  const admins = await Admin.find({ isActive: true }).select('fullName').sort({ fullName: 1 })
  res.json({ data: admins.map(agentDto) })
}

export async function getTicket(req, res) {
  res.json({ ticket: await adminTicketDetail(await findTicket(req)) })
}

const ticketRecord = (t) => ({ type: 'ticket', id: t.id, ref: t.ticketCode })

export async function replyToTicket(req, res) {
  describeAudit(req, { record: { type: 'ticket', id: req.params.id } })
  const ticket = await findTicket(req)
  const statusBefore = ticket.status
  ticket.messages.push({ author: 'admin', admin: req.admin._id, body: req.body.body, attachments: toAttachments(req.files) })
  ticket.firstResponseAt ??= new Date()
  setStatus(ticket, req.body.status, adminActor(req))
  ticket.lastActivityAt = new Date()
  await ticket.save()
  describeAudit(req, {
    record: ticketRecord(ticket),
    investor: investorOf(ticket.user),
    description: `Reply: ${req.body.body.slice(0, 120)}${req.body.body.length > 120 ? '…' : ''}`,
    changes: diff({ Status: statusBefore }, { Status: ticket.status }),
  })
  res.json({ ticket: await adminTicketDetail(ticket) })
}

export async function updateTicket(req, res) {
  describeAudit(req, { record: { type: 'ticket', id: req.params.id } })
  const ticket = await findTicket(req)
  const snapshot = (t) => ({ Status: t.status, Priority: t.priority, 'Assigned to': t.assignedTo?.fullName ?? null })
  const before = snapshot(ticket)
  const { status, priority, assignedTo } = req.body
  const actor = adminActor(req)
  if (status) setStatus(ticket, status, actor)
  if (priority && priority !== ticket.priority) {
    addTicketEvent(ticket, 'priority', ticket.priority, priority, actor)
    ticket.priority = priority
  }
  if (assignedTo !== undefined && String(assignedTo) !== String(ticket.assignedTo?._id ?? null)) {
    const agent = assignedTo ? await Admin.findOne({ _id: assignedTo, isActive: true }).select('fullName') : null
    if (assignedTo && !agent) throw new ApiError(400, 'Agent not found', { assignedTo: 'Agent not found' })
    addTicketEvent(ticket, 'assignment', ticket.assignedTo?.fullName ?? null, agent?.fullName ?? null, actor)
    ticket.assignedTo = assignedTo
  }
  ticket.lastActivityAt = new Date()
  await ticket.save()
  await ticket.populate(...POPULATE_AGENT)
  const changes = diff(before, snapshot(ticket))
  describeAudit(req, { record: ticketRecord(ticket), investor: investorOf(ticket.user), changes, description: summarizeChanges(changes) })
  res.json({ ticket: await adminTicketDetail(ticket) })
}

/** Internal note — visible to admins only. */
export async function addNote(req, res) {
  describeAudit(req, { record: { type: 'ticket', id: req.params.id } })
  const ticket = await findTicket(req)
  ticket.notes.push({ admin: req.admin._id, body: req.body.body })
  await ticket.save()
  describeAudit(req, { record: ticketRecord(ticket), investor: investorOf(ticket.user), description: `Note: ${req.body.body.slice(0, 120)}` })
  res.status(201).json({ ticket: await adminTicketDetail(ticket) })
}

/** Flags the ticket for senior attention and raises it to urgent. */
export async function escalateTicket(req, res) {
  describeAudit(req, { record: { type: 'ticket', id: req.params.id } })
  const ticket = await findTicket(req)
  if (ticket.escalatedAt) throw new ApiError(409, 'This ticket is already escalated')
  if (ticket.status === TICKET_STATUS.RESOLVED) throw new ApiError(409, 'Resolved tickets cannot be escalated')
  const actor = adminActor(req)
  ticket.escalatedAt = new Date()
  ticket.escalatedBy = req.admin._id
  addTicketEvent(ticket, 'escalated', null, null, actor)
  const priorityBefore = ticket.priority
  if (ticket.priority !== 'urgent') {
    addTicketEvent(ticket, 'priority', ticket.priority, 'urgent', actor)
    ticket.priority = 'urgent'
  }
  ticket.lastActivityAt = new Date()
  await ticket.save()
  describeAudit(req, {
    record: ticketRecord(ticket),
    investor: investorOf(ticket.user),
    changes: diff({ Priority: priorityBefore }, { Priority: ticket.priority }),
    description: 'Ticket escalated',
  })
  res.json({ ticket: await adminTicketDetail(ticket) })
}

export async function getAttachment(req, res) {
  sendAttachment(res, await SupportTicket.findById(req.params.id).orFail(new ApiError(404, 'Ticket not found')), req.params.attachmentId)
}

// ---- Error catalog (help articles) ----

const articleDto = (a) => ({
  id: a.id,
  code: a.code,
  category: a.category,
  title: a.title,
  summary: a.summary,
  keywords: a.keywords,
  steps: a.steps,
  published: a.published,
  updatedAt: a.updatedAt,
})

export async function listArticles(req, res) {
  const { q, category, published } = req.validatedQuery
  const rx = q && { $regex: escapeRegex(q), $options: 'i' }
  const filter = {
    ...(category && { category }),
    ...(published && { published: published === 'true' }),
    ...(rx && { $or: [{ code: rx }, { title: rx }, { summary: rx }, { keywords: rx }] }),
  }
  const items = await SupportArticle.find(filter).sort({ code: 1 })
  res.json({ data: items.map(articleDto) })
}

const articleSnapshot = (a) => ({ Code: a.code, Category: a.category, Title: a.title, Summary: a.summary, Keywords: a.keywords, Steps: (a.steps ?? []).join(' | '), Published: a.published })

async function saveArticle(req, article, body) {
  const before = article.isNew ? {} : articleSnapshot(article)
  Object.assign(article, body, { updatedBy: req.admin._id })
  const changes = diff(before, articleSnapshot(article))
  describeAudit(req, {
    record: { type: 'article', id: article.id, ref: article.code },
    changes,
    description: article.isNew ? `${article.code}: ${article.title}` : summarizeChanges(changes),
  })
  try {
    await article.save()
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, `Code ${body.code} is already used`, { code: 'This code is already used' })
    throw err
  }
  return articleDto(article)
}

export async function createArticle(req, res) {
  res.status(201).json({ article: await saveArticle(req, new SupportArticle(), req.body) })
}

export async function updateArticle(req, res) {
  describeAudit(req, { record: { type: 'article', id: req.params.id } })
  const article = await SupportArticle.findById(req.params.id)
  if (!article) throw new ApiError(404, 'Article not found')
  res.json({ article: await saveArticle(req, article, req.body) })
}

export async function deleteArticle(req, res) {
  describeAudit(req, { record: { type: 'article', id: req.params.id } })
  const article = await SupportArticle.findByIdAndDelete(req.params.id)
  if (!article) throw new ApiError(404, 'Article not found')
  describeAudit(req, { record: { type: 'article', id: article.id, ref: article.code }, description: `${article.code}: ${article.title}`, changes: Object.entries(articleSnapshot(article)).map(([field, from]) => ({ field, from, to: null })) })
  res.status(204).end()
}
