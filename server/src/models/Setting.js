import mongoose from 'mongoose'
import env from '../config/env.js'

/** Single document (_id "global") holding everything an admin can configure. */
const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    shares: {
      A: {
        label: { type: String, default: 'Class A' },
        description: { type: String, default: 'Common shares' },
        priceCents: { type: Number, default: 200 },
      },
      B: {
        label: { type: String, default: 'Class B' },
        description: { type: String, default: 'Preferred shares' },
        priceCents: { type: Number, default: 200 },
      },
    },
    // Shares available for sale per class (set in the database; used by the admin overview)
    allocation: {
      A: { type: Number, default: 1_000_000, min: 0 },
      B: { type: Number, default: 1_000_000, min: 0 },
    },
    // % of a completed purchase paid to the buyer's direct referrer (F1), per class
    commissionPct: {
      A: { type: Number, default: 8, min: 0, max: 100 },
      B: { type: Number, default: 8, min: 0, max: 100 },
    },
    // Minimum payable amount of an order (0 = none): before the user's first completed purchase, and after it
    minPurchaseCents: {
      first: { type: Number, default: 0, min: 0 },
      next: { type: Number, default: 0, min: 0 },
    },
    // Admin portal access control: when on, only these addresses (or ranges) can reach it
    adminIpWhitelist: {
      enabled: { type: Boolean, default: false },
      entries: {
        type: [{ _id: false, ip: { type: String, required: true }, note: String, addedAt: { type: Date, default: Date.now } }],
        default: [],
      },
    },
    // How withdrawals are paid out. 'manual': the request is created and an admin sends the USDT by hand.
    // 'auto' (automatic payout) is planned but not available yet.
    withdrawal: {
      mode: { type: String, enum: ['manual', 'auto'], default: 'manual' },
      minUsdt: { type: Number, min: 0, default: () => env.withdrawal.minUsdt },
    },
    payment: {
      bep20: {
        enabled: { type: Boolean, default: false },
        address: { type: String, default: '' }, // receiving wallet
      },
      zelle: {
        enabled: { type: Boolean, default: false },
        recipientName: { type: String, default: '' },
        recipient: { type: String, default: '' }, // email or US phone registered with Zelle
        qrImage: String, // file in storage/settings
      },
    },
  },
  { timestamps: true },
)

const Setting = mongoose.model('Setting', settingSchema)

export async function getSettings() {
  return (await Setting.findById('global')) ?? (await Setting.create({ _id: 'global' }))
}

/** One-off upgrades of the stored settings document; safe to run on every start. */
export async function migrateSettings() {
  // Single commission % → one per class
  await Setting.collection.updateOne({ _id: 'global', referralCommissionPct: { $exists: true } }, [
    { $set: { commissionPct: { A: '$referralCommissionPct', B: '$referralCommissionPct' } } },
    { $unset: 'referralCommissionPct' },
  ])
  // "Share A/B" was renamed to "Class A/B"
  for (const t of ['A', 'B']) {
    await Setting.collection.updateOne({ _id: 'global', [`shares.${t}.label`]: `Share ${t}` }, { $set: { [`shares.${t}.label`]: `Class ${t}` } })
  }
}

export default Setting
