import mongoose from 'mongoose'

export const SHARE_TYPES = ['A', 'B']
// 'other' is only used by manual orders (e.g. a bank transfer an admin confirmed outside the system)
export const PAYMENT_METHODS = ['bep20', 'zelle', 'other']
export const ORDER_STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment', // created, user hasn't paid yet
  PAYING: 'paying', // user picked USDT and is paying from their wallet
  VERIFYING: 'verifying', // BEP20 tx submitted, waiting for on-chain confirmations
  PENDING_REVIEW: 'pending_review', // Zelle (or a BEP20 the system couldn't verify) waiting for an admin
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shareType: { type: String, enum: SHARE_TYPES, required: true },
    // Money is stored in USDT cents to avoid floating point errors
    priceCents: { type: Number, required: true },
    shares: { type: Number, required: true, min: 0.001 }, // fractional (3 decimals), see utils/shares.js
    amountCents: { type: Number, required: true },

    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.AWAITING_PAYMENT, index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    // BEP20: a tx hash can only ever pay for one order
    txHash: { type: String, lowercase: true, unique: true, sparse: true },
    // Tx hash of an unfinished order whose user was deleted; freed so it can be used again
    releasedTxHash: String,
    paymentError: String,
    // Set when an admin created the order by hand (money received, but the order never reached the system)
    manual: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      reference: String, // tx hash / Zelle confirmation / bank reference
      note: String,
      commissionPaid: Boolean, // whether the referrer was paid for this order
    },
    // Background audit of a wallet payment that was accepted instantly; only used to alert admins
    chainCheck: {
      state: { type: String, enum: ['pending', 'verified', 'invalid'] },
      reason: String,
      checkedAt: Date,
    },
    zelleReference: String,
    paidAt: Date,
    completedAt: Date,
    completedBy: { type: String, enum: ['system', 'admin'] },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    rejectionReason: String,

    certificate: {
      filename: String,
      originalName: String,
      mimeType: String,
      uploadedAt: Date,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    },
  },
  { timestamps: true },
)

export default mongoose.model('Order', orderSchema)
