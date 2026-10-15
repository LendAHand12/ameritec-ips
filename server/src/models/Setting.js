import mongoose from 'mongoose'

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
