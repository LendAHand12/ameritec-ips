import { nextSequence } from '../models/Counter.js'
import Order, { ORDER_STATUS } from '../models/Order.js'
import { getSettings } from '../models/Setting.js'
import User from '../models/User.js'
import WalletTransaction, { COMMISSION_STATUS } from '../models/WalletTransaction.js'
import { commissionReleasable, isFaceApproved } from './commission.service.js'
import { verifyUsdtPayment } from './bsc.service.js'
import { notifyPaymentNeedsReview, notifyUnverifiedPayment } from './telegram.service.js'

const OPEN_STATUSES = [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.PAYING, ORDER_STATUS.VERIFYING, ORDER_STATUS.PENDING_REVIEW]
// Give up on a submitted tx that never shows up on-chain
const VERIFY_GIVE_UP_MS = 6 * 60 * 60 * 1000

export async function nextOrderCode() {
  const year = new Date().getFullYear()
  return `ORD-${year}-${String(await nextSequence(`order-${year}`)).padStart(6, '0')}`
}

/** Pays the buyer's direct referrer. Idempotent thanks to the unique (order, type) index. */
async function payReferralCommission(order) {
  const buyer = await User.findById(order.user).select('referredBy status deletedAt faceVerified')
  if (!buyer?.referredBy) return
  const referrer = await User.findById(buyer.referredBy).select('status deletedAt')
  if (!referrer || referrer.deletedAt) return // nobody to pay
  const { commissionPct } = await getSettings()
  const pct = commissionPct[order.shareType] ?? 0
  const amountCents = Math.floor((order.amountCents * pct) / 100)
  if (amountCents <= 0) return

  try {
    await WalletTransaction.create({
      user: buyer.referredBy,
      type: 'referral_commission',
      amountCents,
      order: order._id,
      fromUser: buyer._id,
      commissionPct: pct,
      // Held until the buyer's face scan is approved by an admin. The buyer can still buy without one — only the
      // referrer's commission waits (and the referrer needs their own approved face scan to withdraw it).
      status: commissionReleasable(buyer) ? COMMISSION_STATUS.AVAILABLE : COMMISSION_STATUS.PENDING,
      needsBuyerFace: !isFaceApproved(buyer),
    })
  } catch (err) {
    if (err.code !== 11000) throw err // already paid
  }
}

/** Atomically moves an open order to completed (only once) and pays the commission. */
export async function completeOrder(orderId, { by = 'system', adminId, payCommission = true } = {}) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: OPEN_STATUSES } },
    {
      status: ORDER_STATUS.COMPLETED,
      completedAt: new Date(),
      completedBy: by,
      paidAt: new Date(),
      paymentError: undefined,
      ...(adminId && { reviewedBy: adminId }),
    },
    { new: true },
  )
  if (order && payCommission) await payReferralCommission(order)
  return order
}

/** A USDT payment the chain check couldn't settle now needs a human: tell the admins. */
async function alertAdmins(order, reason) {
  const user = await User.findById(order.user).select('fullName email')
  notifyPaymentNeedsReview(order, user, { method: 'bep20', reason })
}

/**
 * Wallet payments complete the moment the customer's wallet returns a transaction hash — nothing waits for the chain.
 * This runs afterwards, in the background, and never changes the order: it only records the result and alerts the
 * admins on Telegram if the transfer can't be found or doesn't match, so a fake hash doesn't go unnoticed.
 */
export async function auditChainPayment(orderId) {
  const order = await Order.findById(orderId)
  if (!order?.txHash || order.paymentMethod !== 'bep20' || order.chainCheck?.state === 'verified') return

  const { payment } = await getSettings()
  let result
  try {
    result = await verifyUsdtPayment({
      txHash: order.txHash,
      toAddress: payment.bep20.address,
      minAmountCents: order.amountCents,
      notBefore: new Date(order.createdAt.getTime() - 10 * 60 * 1000),
    })
  } catch (err) {
    result = { state: 'pending', reason: err.message }
  }

  const tooOld = Date.now() - (order.paidAt ?? order.updatedAt).getTime() > VERIFY_GIVE_UP_MS
  const state = result.state === 'verified' ? 'verified' : result.state === 'invalid' || tooOld ? 'invalid' : 'pending'
  const reason = result.state === 'pending' && state === 'invalid' ? `Not confirmed on-chain: ${result.reason}` : result.reason
  await Order.updateOne({ _id: order._id }, { chainCheck: { state, reason, checkedAt: new Date() } })

  if (state === 'invalid' && order.chainCheck?.state !== 'invalid') {
    notifyUnverifiedPayment(order, await User.findById(order.user).select('fullName email'), reason)
  }
}

/** Runs the on-chain check for a BEP20 order and updates it. Returns the verification result. */
export async function checkBep20Order(order) {
  const { payment } = await getSettings()
  const result = await verifyUsdtPayment({
    txHash: order.txHash,
    toAddress: payment.bep20.address,
    minAmountCents: order.amountCents,
    // small allowance for clock skew between server and chain
    notBefore: new Date(order.createdAt.getTime() - 10 * 60 * 1000),
  })

  if (result.state === 'verified') {
    await completeOrder(order._id)
  } else if (result.state === 'invalid') {
    // Hand it to an admin instead of silently dropping it — the user may have paid a different way
    const moved = await Order.updateOne(
      { _id: order._id, status: ORDER_STATUS.VERIFYING },
      { status: ORDER_STATUS.PENDING_REVIEW, paymentError: result.reason },
    )
    if (moved.modifiedCount) await alertAdmins(order, result.reason)
  } else {
    const tooOld = Date.now() - (order.paidAt ?? order.updatedAt).getTime() > VERIFY_GIVE_UP_MS
    const reason = `Not confirmed on-chain: ${result.reason}`
    const moved = await Order.updateOne(
      { _id: order._id, status: ORDER_STATUS.VERIFYING },
      tooOld ? { status: ORDER_STATUS.PENDING_REVIEW, paymentError: reason } : { paymentError: result.reason },
    )
    if (tooOld && moved.modifiedCount) await alertAdmins(order, reason)
  }
  return result
}

/** Background job: re-check BEP20 orders still waiting for confirmations. */
export function startBep20Watcher(intervalMs = 60_000) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      // Wallet payments already completed: keep auditing until the chain confirms or we give up and alert
      const toAudit = await Order.find({ status: ORDER_STATUS.COMPLETED, 'chainCheck.state': 'pending' }).limit(50)
      for (const order of toAudit) {
        await auditChainPayment(order._id).catch((err) => console.error(`Chain audit failed for ${order.orderCode}:`, err.message))
      }
      const orders = await Order.find({ status: ORDER_STATUS.VERIFYING, paymentMethod: 'bep20' }).limit(50)
      for (const order of orders) {
        await checkBep20Order(order).catch((err) => console.error(`BEP20 check failed for ${order.orderCode}:`, err.message))
      }
    } finally {
      running = false
    }
  }
  return setInterval(tick, intervalMs)
}
