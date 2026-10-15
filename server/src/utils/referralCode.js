import crypto from 'crypto'

// No 0/O/1/I to avoid confusion when people type the code by hand
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateReferralCode(length = 8) {
  let code = ''
  for (let i = 0; i < length; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return code
}
