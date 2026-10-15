import mongoose from 'mongoose'

/** Named atomic sequences (e.g. "kyc-2026" → 1, 2, 3 …). */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

export async function nextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true })
  return counter.seq
}

const Counter = mongoose.model('Counter', counterSchema)
export default Counter
