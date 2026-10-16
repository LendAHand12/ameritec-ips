import mongoose from 'mongoose'
import { nextSequence } from './Counter.js'

export const WITHDRAWAL_STATUS = { PENDING: 'pending', PAID: 'paid', REJECTED: 'rejected' }

/**
 * A request to pay out available commission (USDT on BNB Smart Chain) to the user's own wallet.
 * Pending and paid requests are subtracted from the user's balance; a rejected one gives the money back.
 */
const withdrawalSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true }, // WD-2026-000001
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountCents: { type: Number, required: true, min: 1 },
    // Snapshot of the wallet at request time: changing the saved wallet later never redirects an existing request
    address: { type: String, required: true },
    status: { type: String, enum: Object.values(WITHDRAWAL_STATUS), default: WITHDRAWAL_STATUS.PENDING, index: true },
    txHash: String,
    rejectionReason: String,
    processedAt: Date,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
)

withdrawalSchema.pre('save', async function () {
  if (!this.code) {
    const year = new Date().getFullYear()
    this.code = `WD-${year}-${String(await nextSequence(`withdrawal-${year}`)).padStart(6, '0')}`
  }
})

export default mongoose.model('Withdrawal', withdrawalSchema)
