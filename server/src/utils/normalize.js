import { parsePhoneNumberFromString } from 'libphonenumber-js/max'

// Invisible format characters (zero-width space/joiners, BOM, ...) that sneak in when copy-pasting
const INVISIBLE_CHARS = /\p{Cf}/gu

export const normalizeEmail = (value) =>
  String(value ?? '').normalize('NFKC').replace(INVISIBLE_CHARS, '').trim().toLowerCase()

export const normalizeReferralCode = (value) =>
  String(value ?? '').replace(INVISIBLE_CHARS, '').replace(/\s+/g, '').toUpperCase()

export const normalizeFullName = (value) =>
  String(value ?? '').replace(INVISIBLE_CHARS, '').trim().replace(/\s+/g, ' ')

/** Returns the E.164 number (e.g. +84901234567) or null if invalid for the given country. */
export function normalizePhone(phoneNumber, country) {
  const parsed = parsePhoneNumberFromString(String(phoneNumber ?? ''), country)
  if (!parsed?.isValid()) return null
  return parsed.number
}
