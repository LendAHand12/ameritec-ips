// Keep in sync with server/src/utils/normalize.js
const INVISIBLE_CHARS = /\p{Cf}/gu

export const normalizeEmail = (value) =>
  String(value ?? '').normalize('NFKC').replace(INVISIBLE_CHARS, '').trim().toLowerCase()

export const normalizeReferralCode = (value) =>
  String(value ?? '').replace(INVISIBLE_CHARS, '').replace(/\s+/g, '').toUpperCase()
