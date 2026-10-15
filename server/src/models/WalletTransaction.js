import mongoose from 'mongoose'

/**
 * Wallet ledger. A user's balance is the sum of their entries (no denormalised balance to drift).
 * Currently only referral commissions credit the wallet.
 */
const walletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['referral_commission'], required: true },
    amountCents: { type: Number, required: true },
    // Source of a commission
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commissionPct: Number,
  },
  { timestamps: true },
)

// One commission per order, so completing an order twice can never pay twice
walletTransactionSchema.index({ order: 1, type: 1 }, { unique: true, partialFilterExpression: { order: { $exists: true } } })

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema)

export async function getBalanceCents(userId) {
  const [row] = await WalletTransaction.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    { $group: { _id: null, total: { $sum: '$amountCents' } } },
  ])
  return row?.total ?? 0
}

export default WalletTransaction
