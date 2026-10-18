import mongoose from 'mongoose'
import Withdrawal, { WITHDRAWAL_STATUS } from './Withdrawal.js'

/**
 * Wallet ledger. A user's balance is the sum of their entries (no denormalised balance to drift).
 * Referral commissions credit the wallet; an admin can also add or deduct an amount by hand (with a reason).
 */
export const COMMISSION_STATUS = { PENDING: 'pending', AVAILABLE: 'available' }

const walletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['referral_commission', 'admin_adjustment'], required: true },
    amountCents: { type: Number, required: true },
    // Source of a commission
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commissionPct: Number,
    // Pending until both the earner and the buyer are KYC-approved; only available funds count as balance
    status: { type: String, enum: Object.values(COMMISSION_STATUS), default: COMMISSION_STATUS.AVAILABLE, index: true },
    releasedAt: Date,
    // admin_adjustment: signed amount (negative = deduction), who did it and why (the user can see the reason)
    reason: String,
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    // The buyer had no admin-approved face scan when this was earned: stays pending until they do
    needsBuyerFace: Boolean,
  },
  { timestamps: true },
)

// One commission per order, so completing an order twice can never pay twice
walletTransactionSchema.index({ order: 1, type: 1 }, { unique: true, partialFilterExpression: { order: { $exists: true } } })

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema)

const COMMISSION_TYPE = 'referral_commission'

const sumCents = async (userId, status, type) => {
  const [row] = await WalletTransaction.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)), status, ...(type && { type }) } },
    { $group: { _id: null, total: { $sum: '$amountCents' } } },
  ])
  return row?.total ?? 0
}

const withdrawnCents = async (userId, status) => {
  const [row] = await Withdrawal.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)), status } },
    { $group: { _id: null, total: { $sum: '$amountCents' } } },
  ])
  return row?.total ?? 0
}

/** Withdrawable balance: available commissions minus withdrawals already requested or paid. */
export async function getBalanceCents(userId) {
  const [earned, requested, paid] = await Promise.all([
    sumCents(userId, COMMISSION_STATUS.AVAILABLE),
    withdrawnCents(userId, WITHDRAWAL_STATUS.PENDING),
    withdrawnCents(userId, WITHDRAWAL_STATUS.PAID),
  ])
  return earned - requested - paid
}

/** Everything the wallet screens show, in cents. */
export async function getWalletSummary(userId) {
  const [available, adjusted, pending, requested, paid] = await Promise.all([
    sumCents(userId, COMMISSION_STATUS.AVAILABLE, COMMISSION_TYPE),
    sumCents(userId, COMMISSION_STATUS.AVAILABLE, 'admin_adjustment'),
    sumCents(userId, COMMISSION_STATUS.PENDING),
    withdrawnCents(userId, WITHDRAWAL_STATUS.PENDING),
    withdrawnCents(userId, WITHDRAWAL_STATUS.PAID),
  ])
  return {
    earnedCents: available + pending, // commission credited, adjustments not included
    adjustmentCents: adjusted, // net of admin additions / deductions
    availableCents: available + adjusted - requested - paid, // can be withdrawn now
    pendingCents: pending, // waiting for the buyer's face scan to be approved
    requestedCents: requested, // withdrawal requests awaiting payment
    withdrawnCents: paid,
  }
}

/** Commissions earned but not yet withdrawable (waiting for KYC approval). */
export const getPendingCents = (userId) => sumCents(userId, COMMISSION_STATUS.PENDING)

export default WalletTransaction
