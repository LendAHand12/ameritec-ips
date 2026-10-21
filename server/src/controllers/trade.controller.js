import path from 'path'
import env from '../config/env.js'
import Order, { ORDER_STATUS } from '../models/Order.js'
import { getSettings } from '../models/Setting.js'
import { getBalanceCents, getPendingCents } from '../models/WalletTransaction.js'
import ApiError from '../utils/ApiError.js'
import { fromCents } from '../utils/money.js'
import { roundShares } from '../utils/shares.js'
import { auditChainPayment, checkBep20Order, completeOrder, nextOrderCode } from '../services/order.service.js'
import { notifyPaymentNeedsReview } from '../services/telegram.service.js'

// Zelle is only offered to US (+1) phone numbers
const canUseZelle = (user) => user.phone?.startsWith('+1')

export const toOrderDto = (o) => ({
  id: o.id,
  orderCode: o.orderCode,
  shareType: o.shareType,
  price: fromCents(o.priceCents),
  shares: o.shares,
  amount: fromCents(o.amountCents),
  status: o.status,
  paymentMethod: o.paymentMethod ?? null,
  txHash: o.txHash ?? null,
  zelleReference: o.zelleReference ?? null,
  paymentError: o.paymentError ?? null,
  rejectionReason: o.rejectionReason ?? null,
  hasCertificate: !!o.certificate?.filename,
  certificateMime: o.certificate?.filename ? (o.certificate.mimeType ?? null) : null,
  createdAt: o.createdAt,
  paidAt: o.paidAt ?? null,
  completedAt: o.completedAt ?? null,
})

/** The minimum an order must cost: the first-purchase minimum until the user has a completed order. */
async function minPurchaseFor(userId, settings) {
  const firstPurchase = !(await Order.exists({ user: userId, status: ORDER_STATUS.COMPLETED }))
  return { firstPurchase, minCents: settings.minPurchaseCents[firstPurchase ? 'first' : 'next'] }
}

async function findMyOrder(req) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
  if (!order) throw new ApiError(404, 'Order not found')
  return order
}

const sharesDto = (settings) =>
  ['A', 'B'].map((type) => ({
    type,
    label: settings.shares[type].label,
    description: settings.shares[type].description,
    price: fromCents(settings.shares[type].priceCents),
  }))

/** Everything the Trade page needs: class prices, payment methods for this user, wallet balance. */
export async function getTradeConfig(req, res) {
  const settings = await getSettings()
  const { bep20, zelle } = settings.payment
  const { firstPurchase, minCents } = await minPurchaseFor(req.user._id, settings)
  res.json({
    shares: sharesDto(settings),
    minPurchase: { amount: fromCents(minCents), firstPurchase },
    paymentMethods: {
      bep20:
        bep20.enabled && bep20.address
          ? {
              network: 'BNB Smart Chain (BEP20)',
              token: 'USDT',
              address: bep20.address,
              // What the browser wallet needs to send the transfer itself
              chainId: 56,
              contract: env.bsc.usdtContract,
              decimals: 18,
            }
          : null,
      zelle:
        zelle.enabled && zelle.qrImage && canUseZelle(req.user)
          ? { hasQr: true } // customers pay by scanning the admin's Zelle QR code
          : null,
    },
    // Why Zelle isn't offered, so the screen can say so: the admin hasn't set it up, or this account isn't a US (+1) number
    zelleUnavailable: !zelle.enabled || !zelle.qrImage ? 'not_configured' : !canUseZelle(req.user) ? 'us_only' : null,
    balance: fromCents(await getBalanceCents(req.user._id)),
    pendingBalance: fromCents(await getPendingCents(req.user._id)),
  })
}

/** Holdings + recent orders for the dashboard. */
export async function getPortfolio(req, res) {
  const [settings, completed, recent, balanceCents, pendingCents] = await Promise.all([
    getSettings(),
    Order.find({ user: req.user._id, status: ORDER_STATUS.COMPLETED }).sort({ completedAt: 1 }),
    Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5),
    getBalanceCents(req.user._id),
    getPendingCents(req.user._id),
  ])

  const holdings = Object.fromEntries(['A', 'B'].map((t) => [t, { shares: 0, investedCents: 0 }]))
  for (const o of completed) {
    holdings[o.shareType].shares = roundShares(holdings[o.shareType].shares + o.shares)
    holdings[o.shareType].investedCents += o.amountCents
  }
  const valueCents = (type) => Math.round(holdings[type].shares * settings.shares[type].priceCents)

  res.json({
    balance: fromCents(balanceCents),
    pendingBalance: fromCents(pendingCents),
    shares: sharesDto(settings).map((s) => ({
      ...s,
      quantity: holdings[s.type].shares,
      value: fromCents(valueCents(s.type)),
      invested: fromCents(holdings[s.type].investedCents),
    })),
    totalShares: roundShares(holdings.A.shares + holdings.B.shares),
    totalValue: fromCents(valueCents('A') + valueCents('B')),
    totalInvested: fromCents(holdings.A.investedCents + holdings.B.investedCents),
    // Holdings over time (valued at the current price) for the performance chart
    history: completed.map((o) => ({ date: o.completedAt, shareType: o.shareType, shares: o.shares })),
    recentOrders: recent.map(toOrderDto),
  })
}

export async function createOrder(req, res) {
  const { shareType, shares } = req.body
  const settings = await getSettings()
  const priceCents = settings.shares[shareType].priceCents
  if (!priceCents) throw new ApiError(400, 'This class is not available right now')

  // Whole shares: the user pays shares × price, to the cent
  const amountCents = shares * priceCents
  const { firstPurchase, minCents } = await minPurchaseFor(req.user._id, settings)
  if (amountCents < minCents) {
    const msg = `Minimum ${firstPurchase ? 'first purchase' : 'purchase'} is ${fromCents(minCents).toFixed(2)} USDT`
    throw new ApiError(400, msg, { shares: msg })
  }

  const order = await Order.create({
    orderCode: await nextOrderCode(),
    user: req.user._id,
    shareType,
    priceCents,
    shares,
    amountCents,
  })
  res.status(201).json({ order: toOrderDto(order) })
}

export async function listMyOrders(req, res) {
  const { page, limit } = req.validatedQuery
  const filter = { user: req.user._id }
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ])
  res.json({ data: items.map(toOrderDto), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
}

export async function getMyOrder(req, res) {
  res.json({ order: toOrderDto(await findMyOrder(req)) })
}

export async function submitPayment(req, res) {
  const order = await findMyOrder(req)
  if (order.status !== ORDER_STATUS.AWAITING_PAYMENT && order.status !== ORDER_STATUS.PAYING) {
    throw new ApiError(409, 'Payment for this order has already been submitted', undefined, 'ORDER_NOT_PAYABLE')
  }

  const settings = await getSettings()
  const { method } = req.body

  if (method === 'bep20') {
    if (!settings.payment.bep20.enabled || !settings.payment.bep20.address) throw new ApiError(400, 'USDT payment is not available')
    if (await Order.exists({ txHash: req.body.txHash, _id: { $ne: order._id } })) {
      throw new ApiError(409, 'This transaction has already been used for another order', { txHash: 'Transaction already used' }, 'TX_ALREADY_USED')
    }
    order.paymentMethod = 'bep20'
    order.txHash = req.body.txHash
    order.paymentError = undefined
    order.paidAt = new Date()
    await order.save()

    // The customer's wallet sent the transfer, so the order completes right now — no waiting on the chain.
    // The background audit only alerts the admins if the transfer turns out not to exist or not to match.
    const completed = await completeOrder(order._id)
    if (!completed) throw new ApiError(409, 'Payment for this order has already been submitted', undefined, 'ORDER_NOT_PAYABLE')
    await Order.updateOne({ _id: order._id }, { chainCheck: { state: 'pending', checkedAt: new Date() } })
    auditChainPayment(order._id).catch((err) => console.error(`Chain audit failed for ${order.orderCode}:`, err.message))
  } else {
    if (!settings.payment.zelle.enabled || !settings.payment.zelle.qrImage || !canUseZelle(req.user)) throw new ApiError(400, 'Zelle is not available for your account')
    order.paymentMethod = 'zelle'
    order.zelleReference = req.body.reference
    order.status = ORDER_STATUS.PENDING_REVIEW
    order.paidAt = new Date()
    await order.save()
    // Ping the admins' Telegram so someone checks the Zelle transfer and approves the order
    notifyPaymentNeedsReview(order, req.user, { method: 'zelle', reference: order.zelleReference })
  }

  res.json({ order: toOrderDto(await Order.findById(order._id)) })
}

/** Lets the client poll a VERIFYING order (also re-runs the on-chain check). */
export async function refreshPayment(req, res) {
  const order = await findMyOrder(req)
  if (order.status === ORDER_STATUS.VERIFYING) {
    await checkBep20Order(order).catch((err) => console.error(`BEP20 check failed for ${order.orderCode}:`, err.message))
  }
  res.json({ order: toOrderDto(await Order.findById(order._id)) })
}

/** The customer chose USDT and is about to pay from their wallet: the order moves to "paying". */
export async function startPayment(req, res) {
  const settings = await getSettings()
  if (!settings.payment.bep20.enabled || !settings.payment.bep20.address) throw new ApiError(400, 'USDT payment is not available')
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: { $in: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.PAYING] } },
    { status: ORDER_STATUS.PAYING, paymentMethod: 'bep20' },
    { new: true },
  )
  if (!order) throw new ApiError(409, 'This order can no longer be paid', undefined, 'ORDER_NOT_PAYABLE')
  res.json({ order: toOrderDto(order) })
}

export async function cancelOrder(req, res) {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: { $in: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.PAYING] } },
    { status: ORDER_STATUS.CANCELLED },
    { new: true },
  )
  if (!order) throw new ApiError(409, 'Only unpaid orders can be cancelled')
  res.json({ order: toOrderDto(order) })
}

export async function downloadCertificate(req, res) {
  const order = await findMyOrder(req)
  if (!order.certificate?.filename) throw new ApiError(404, 'Certificate not available yet')
  const file = path.resolve(env.certificates.dir, path.basename(order.certificate.filename))
  // ?inline=1 lets the order page show the certificate in place instead of downloading it
  if (req.query.inline) {
    res.set('Cache-Control', 'private, max-age=300')
    return res.sendFile(file)
  }
  res.download(file, `${order.orderCode}-certificate${path.extname(order.certificate.filename)}`)
}

export async function getZelleQr(req, res) {
  const { payment } = await getSettings()
  if (!payment.zelle.enabled || !payment.zelle.qrImage || !canUseZelle(req.user)) throw new ApiError(404, 'Not found')
  res.set('Cache-Control', 'private, max-age=300')
  res.sendFile(path.basename(payment.zelle.qrImage), { root: path.resolve(env.settingsDir) })
}
