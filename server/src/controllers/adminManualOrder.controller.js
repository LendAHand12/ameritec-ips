import Order, { ORDER_STATUS } from '../models/Order.js'
import { getSettings } from '../models/Setting.js'
import User, { USER_STATUS } from '../models/User.js'
import WalletTransaction from '../models/WalletTransaction.js'
import ApiError from '../utils/ApiError.js'
import { toCents } from '../utils/money.js'
import { MIN_SHARES, sharesFor } from '../utils/shares.js'
import { describeAudit, investorOf } from '../services/audit.service.js'
import { completeOrder, nextOrderCode } from '../services/order.service.js'
import { toOrderDto } from './trade.controller.js'

const TX_HASH = /^0x[0-9a-fA-F]{64}$/

/**
 * Creates a completed order by hand for a user whose payment arrived but never made it into the system.
 * Shares are credited immediately at the current class price; the admin chooses whether the referrer
 * earns commission for it.
 */
export async function createManualOrder(req, res) {
  describeAudit(req, { record: { type: 'user', id: req.params.id } })
  const { shareType, amount, paymentMethod, reference, note, payCommission } = req.body
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')
  if (user.deletedAt) throw new ApiError(409, 'This user has been deleted')
  if (user.status !== USER_STATUS.APPROVED) throw new ApiError(409, 'Only KYC-approved users can hold shares. Approve the user first.')

  const settings = await getSettings()
  const priceCents = settings.shares[shareType].priceCents
  if (!priceCents) throw new ApiError(400, 'This class is not available right now')
  const amountCents = toCents(amount)
  const shares = sharesFor(amountCents, priceCents)
  if (shares < MIN_SHARES) throw new ApiError(400, 'That amount is too small to buy any shares', { amount: 'Amount is too small' })

  // A tx hash can only ever pay for one order
  const txHash = paymentMethod === 'bep20' && reference && TX_HASH.test(reference) ? reference.toLowerCase() : undefined
  if (txHash && (await Order.exists({ txHash }))) {
    throw new ApiError(409, 'This transaction hash has already been used for another order', { reference: 'Transaction already used' })
  }

  const order = await Order.create({
    orderCode: await nextOrderCode(),
    user: user._id,
    shareType,
    priceCents,
    shares,
    amountCents,
    paymentMethod,
    ...(txHash && { txHash }),
    ...(paymentMethod === 'zelle' && reference && { zelleReference: reference }),
    manual: { createdBy: req.admin._id, reference, note, commissionPaid: payCommission },
  })
  const completed = await completeOrder(order._id, { by: 'admin', adminId: req.admin._id, payCommission })
  if (!completed) throw new ApiError(500, 'Could not complete the order')

  const commission = payCommission ? await WalletTransaction.findOne({ order: completed._id }) : null
  describeAudit(req, {
    investor: investorOf(user),
    record: { type: 'order', id: completed.id, ref: completed.orderCode },
    description: `Manual order ${completed.orderCode}: ${amountCents / 100} USDT → ${shares} Class ${shareType} shares for ${user.fullName}; referral commission ${payCommission ? (commission ? `paid (${commission.amountCents / 100} USDT, ${commission.status})` : 'requested but none due (no referrer)') : 'not paid'}${note ? ` — ${note}` : ''}`,
  })
  res.status(201).json({
    data: {
      order: toOrderDto(completed),
      commission: commission && { amount: commission.amountCents / 100, status: commission.status },
    },
  })
}
