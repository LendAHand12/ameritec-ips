import { nextSequence } from '../models/Counter.js'

/** KYC application reference shown to users, e.g. AMT-KYC-2026-001284 (sequence restarts each year). */
export async function nextApplicationId(date = new Date()) {
  const year = date.getFullYear()
  const seq = await nextSequence(`kyc-${year}`)
  return `AMT-KYC-${year}-${String(seq).padStart(6, '0')}`
}

/** Assigns an application ID to accounts created before IDs existed. */
export async function ensureApplicationId(user) {
  if (user.applicationId) return user.applicationId
  user.applicationId = await nextApplicationId(user.createdAt ?? new Date())
  await user.save()
  return user.applicationId
}

export const applicationSummary = async (user) => ({
  applicationId: await ensureApplicationId(user),
  submittedAt: user.createdAt,
  status: user.status,
  ...(user.rejectionReason && { reason: user.rejectionReason }),
})
