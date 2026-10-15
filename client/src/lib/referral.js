import { normalizeReferralCode } from './normalize'

const STORAGE_KEY = 'referral_code'
export const REFERRAL_PARAM = 'ref'

export function getStoredReferralCode() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Saves the code, replacing any previous one. Only called when the user arrives through a referral link. */
export function storeReferralCode(code) {
  const normalized = normalizeReferralCode(code)
  if (!normalized) return
  try {
    localStorage.setItem(STORAGE_KEY, normalized)
  } catch {
    // Storage unavailable (private mode, blocked) — the code still works for this visit via the URL
  }
}

export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export const buildReferralLink = (code) => `${window.location.origin}/register?${REFERRAL_PARAM}=${encodeURIComponent(code)}`
