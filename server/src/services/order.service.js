import { nextSequence } from '../models/Counter.js'
import Order, { ORDER_STATUS } from '../models/Order.js'
import { getSettings } from '../models/Setting.js'
import User from '../models/User.js'
import WalletTransaction from '../models/WalletTransaction.js'
import { verifyUsdtPayment } from './bsc.service.js'

const OPEN_STATUSES = [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.VERIFYING, ORDER_STATUS.PENDING_REVIEW]
// Give up on a submitted tx that never shows up on-chain
const VERIFY_GIVE_UP_MS = 6 * 60 * 60 * 1000

export async function nextOrderCode() {
  const year = new Date().getFullYear()
  return `ORD-${year}-${String(await nextSequence(`order-${year}`)).padStart(6, '0')}`
}

/** Pays the buyer's direct referrer. Idempotent thanks to the unique (order, type) index. */
async function payReferralCommission(order) {
  const buyer = await User.findById(order.user).select('referredBy')
  if (!buyer?.referredBy) return
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
    })
  } catch (err) {
    if (err.code !== 11000) throw err // already paid
  }
}

/** Atomically moves an open order to completed (only once) and pays the commission. */
export async function completeOrder(orderId, { by = 'system', adminId } = {}) {
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
  if (order) await payReferralCommission(order)
  return order
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
    await Order.updateOne(
      { _id: order._id, status: ORDER_STATUS.VERIFYING },
      { status: ORDER_STATUS.PENDING_REVIEW, paymentError: result.reason },
    )
  } else {
    const tooOld = Date.now() - (order.paidAt ?? order.updatedAt).getTime() > VERIFY_GIVE_UP_MS
    await Order.updateOne(
      { _id: order._id, status: ORDER_STATUS.VERIFYING },
      tooOld ? { status: ORDER_STATUS.PENDING_REVIEW, paymentError: `Not confirmed on-chain: ${result.reason}` } : { paymentError: result.reason },
    )
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
