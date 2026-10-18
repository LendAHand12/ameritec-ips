import fs from 'fs'
import path from 'path'
import env from '../config/env.js'
import Order, { ORDER_STATUS } from '../models/Order.js'
import { getSettings } from '../models/Setting.js'
import ApiError from '../utils/ApiError.js'
import { fromCents, toCents } from '../utils/money.js'
import { roundShares } from '../utils/shares.js'
import { completeOrder } from '../services/order.service.js'
import { toOrderDto } from './trade.controller.js'
import { describeAudit, diff, investorOf, summarizeChanges } from '../services/audit.service.js'
import User from '../models/User.js'

const orderRecord = (o) => ({ type: 'order', id: String(o._id ?? o.id), ref: o.orderCode })

/** Flat, human-labelled view of the settings for before/after audit diffs. */
const settingsSnapshot = (s) => ({
  ...Object.fromEntries(
    ['A', 'B'].flatMap((t) => [
      [`Class ${t} price (USDT)`, fromCents(s.shares[t].priceCents)],
      [`Class ${t} F1 commission (%)`, s.commissionPct[t]],
      [`Class ${t} shares available`, s.allocation[t]],
      [`Class ${t} name`, s.shares[t].label],
      [`Class ${t} description`, s.shares[t].description],
    ]),
  ),
  'Minimum first purchase (USDT)': fromCents(s.minPurchaseCents.first),
  'Minimum later purchase (USDT)': fromCents(s.minPurchaseCents.next),
  'USDT (BEP20) enabled': s.payment.bep20.enabled,
  'BEP20 wallet address': s.payment.bep20.address,
  'Zelle enabled': s.payment.zelle.enabled,
})

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const removeFile = (dir, filename) => filename && fs.promises.unlink(path.resolve(dir, path.basename(filename))).catch(() => {})

const toAdminOrderDto = (o) => ({
  ...toOrderDto(o),
  user: o.user && { id: o.user.id, fullName: o.user.fullName, email: o.user.email, phone: o.user.phone, referralCode: o.user.referralCode },
  completedBy: o.completedBy ?? null,
  // Background on-chain audit of an instantly-completed wallet payment
  chainCheck: o.chainCheck?.state ? { state: o.chainCheck.state, reason: o.chainCheck.reason ?? null } : null,
  certificate: o.certificate?.filename ? { originalName: o.certificate.originalName, uploadedAt: o.certificate.uploadedAt } : null,
})

async function findOrderOrThrow(id) {
  const order = await Order.findById(id).populate('user', 'fullName email phone referralCode')
  if (!order) throw new ApiError(404, 'Order not found')
  return order
}

export async function listOrders(req, res) {
  const { q, status, paymentMethod, shareType, page, limit } = req.validatedQuery
  const filter = {
    ...(status && { status }),
    ...(paymentMethod && { paymentMethod }),
    ...(shareType && { shareType }),
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    const users = await User.find({ $or: [{ fullName: rx }, { email: rx }, { referralCode: rx }] }).select('_id').limit(200)
    filter.$or = [{ orderCode: rx }, { txHash: rx }, { zelleReference: rx }, { user: { $in: users.map((u) => u._id) } }]
  }

  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'fullName email phone referralCode'),
    Order.countDocuments(filter),
  ])
  res.json({ data: items.map(toAdminOrderDto), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function getOrderStats(req, res) {
  const [byStatus, revenue, missingCertificates] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { status: ORDER_STATUS.COMPLETED } }, { $group: { _id: null, cents: { $sum: '$amountCents' }, shares: { $sum: '$shares' } } }]),
    Order.countDocuments({ status: ORDER_STATUS.COMPLETED, 'certificate.filename': { $exists: false } }),
  ])
  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]))
  res.json({
    data: {
      total: byStatus.reduce((sum, s) => sum + s.count, 0),
      pendingReview: counts[ORDER_STATUS.PENDING_REVIEW] ?? 0,
      verifying: counts[ORDER_STATUS.VERIFYING] ?? 0,
      completed: counts[ORDER_STATUS.COMPLETED] ?? 0,
      missingCertificates,
      revenue: fromCents(revenue[0]?.cents ?? 0),
      sharesSold: roundShares(revenue[0]?.shares ?? 0),
    },
  })
}

export async function getOrder(req, res) {
  res.json({ data: toAdminOrderDto(await findOrderOrThrow(req.params.id)) })
}

/** Confirms payment manually (Zelle, or a BEP20 payment the system couldn't verify). */
export async function approveOrder(req, res) {
  describeAudit(req, { record: { type: 'order', id: req.params.id } })
  const completed = await completeOrder(req.params.id, { by: 'admin', adminId: req.admin._id })
  if (!completed) throw new ApiError(409, 'Only open orders can be approved')
  describeAudit(req, { investor: investorOf(await User.findById(completed.user).select('fullName referralCode')), record: orderRecord(completed), description: `Payment confirmed: ${fromCents(completed.amountCents)} USDT, ${completed.shares} Class ${completed.shareType} shares` })
  res.json({ data: toAdminOrderDto(await findOrderOrThrow(req.params.id)) })
}

export async function rejectOrder(req, res) {
  describeAudit(req, { record: { type: 'order', id: req.params.id }, description: `Rejected: ${req.body.reason}` })
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: { $in: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.PAYING, ORDER_STATUS.VERIFYING, ORDER_STATUS.PENDING_REVIEW] } },
    { status: ORDER_STATUS.REJECTED, rejectionReason: req.body.reason, reviewedBy: req.admin._id },
    { new: true },
  )
  if (!order) throw new ApiError(409, 'Only open orders can be rejected')
  describeAudit(req, { investor: investorOf(await User.findById(order.user).select('fullName referralCode')), record: orderRecord(order) })
  res.json({ data: toAdminOrderDto(await findOrderOrThrow(order._id)) })
}

export async function uploadCertificate(req, res) {
  describeAudit(req, { record: { type: 'order', id: req.params.id } })
  if (!req.file) throw new ApiError(400, 'Choose a certificate file', { certificate: 'Required' })
  const order = await findOrderOrThrow(req.params.id)
  describeAudit(req, { investor: investorOf(order.user), record: orderRecord(order), description: `${order.certificate?.filename ? 'Replaced' : 'Uploaded'} certificate (${req.file.originalname})` })
  if (order.status !== ORDER_STATUS.COMPLETED) throw new ApiError(409, 'Certificates can only be added to completed orders')

  const previous = order.certificate?.filename
  order.certificate = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    uploadedAt: new Date(),
    uploadedBy: req.admin._id,
  }
  await order.save()
  if (previous) removeFile(env.certificates.dir, previous)

  res.json({ data: toAdminOrderDto(order) })
}

export async function getCertificate(req, res) {
  const order = await findOrderOrThrow(req.params.id)
  if (!order.certificate?.filename) throw new ApiError(404, 'No certificate uploaded')
  res.set('Cache-Control', 'private, no-store')
  res.sendFile(path.basename(order.certificate.filename), { root: path.resolve(env.certificates.dir) })
}

// ---- Operational parameters ----

const settingsDto = (s) => ({
  shares: Object.fromEntries(
    ['A', 'B'].map((t) => [
      t,
      { label: s.shares[t].label, description: s.shares[t].description, price: fromCents(s.shares[t].priceCents), commissionPct: s.commissionPct[t], allocation: s.allocation[t] },
    ]),
  ),
  minPurchase: { first: fromCents(s.minPurchaseCents.first), next: fromCents(s.minPurchaseCents.next) },
  payment: {
    bep20: { enabled: s.payment.bep20.enabled, address: s.payment.bep20.address },
    zelle: {
      enabled: s.payment.zelle.enabled,
      hasQr: !!s.payment.zelle.qrImage,
    },
  },
  updatedAt: s.updatedAt,
})

export async function getSettingsHandler(req, res) {
  res.json({ data: settingsDto(await getSettings()) })
}

export async function updateSettings(req, res) {
  const { shares, minPurchase, payment } = req.body
  if (payment.bep20.enabled && !payment.bep20.address) {
    throw new ApiError(400, 'Enter the receiving wallet address to enable USDT payments', { 'payment.bep20.address': 'Required when enabled' })
  }

  const settings = await getSettings()
  if (payment.zelle.enabled && !settings.payment.zelle.qrImage) {
    throw new ApiError(400, 'Upload the Zelle QR code to enable Zelle payments', { 'payment.zelle.enabled': 'Upload the QR code first' })
  }
  const before = settingsSnapshot(settings)
  for (const t of ['A', 'B']) {
    settings.shares[t].label = shares[t].label
    settings.shares[t].description = shares[t].description
    settings.shares[t].priceCents = toCents(shares[t].price)
    settings.commissionPct[t] = shares[t].commissionPct
    settings.allocation[t] = shares[t].allocation
  }
  settings.minPurchaseCents.first = toCents(minPurchase.first)
  settings.minPurchaseCents.next = toCents(minPurchase.next)
  settings.payment.bep20.enabled = payment.bep20.enabled
  settings.payment.bep20.address = payment.bep20.address
  settings.payment.zelle.enabled = payment.zelle.enabled
  await settings.save()

  const changes = diff(before, settingsSnapshot(settings))
  describeAudit(req, { record: { type: 'settings', id: 'global', ref: 'Operational Parameters' }, changes, description: summarizeChanges(changes) })

  res.json({ data: settingsDto(settings) })
}

export async function uploadZelleQr(req, res) {
  if (!req.file) throw new ApiError(400, 'Choose an image', { qr: 'Required' })
  const settings = await getSettings()
  describeAudit(req, { record: { type: 'settings', id: 'global', ref: 'Operational Parameters' }, description: `${settings.payment.zelle.qrImage ? 'Replaced' : 'Uploaded'} Zelle QR code` })
  const previous = settings.payment.zelle.qrImage
  settings.payment.zelle.qrImage = req.file.filename
  await settings.save()
  if (previous) removeFile(env.settingsDir, previous)
  res.json({ data: settingsDto(settings) })
}

export async function getZelleQrAdmin(req, res) {
  const { payment } = await getSettings()
  if (!payment.zelle.qrImage) throw new ApiError(404, 'No QR uploaded')
  res.set('Cache-Control', 'private, no-store')
  res.sendFile(path.basename(payment.zelle.qrImage), { root: path.resolve(env.settingsDir) })
}

