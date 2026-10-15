import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import env from '../config/env.js'

const PERIOD = 30

const buildTotp = (secret, label = '') =>
  new OTPAuth.TOTP({
    issuer: env.appName,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
    secret: typeof secret === 'string' ? OTPAuth.Secret.fromBase32(secret) : secret,
  })

export async function generateTwoFactorSecret(email) {
  const totp = buildTotp(new OTPAuth.Secret({ size: 20 }), email)
  const otpauthUrl = totp.toString()
  return {
    secret: totp.secret.base32,
    otpauthUrl,
    qrCode: await QRCode.toDataURL(otpauthUrl),
  }
}

/**
 * Returns the matched time-step, or null if the code is invalid.
 * Pass lastUsedStep to reject a code that was already used (replay).
 */
export function verifyTwoFactorCode(secret, code, lastUsedStep) {
  const delta = buildTotp(secret).validate({ token: code, window: 1 })
  if (delta === null) return null
  const step = Math.floor(Date.now() / 1000 / PERIOD) + delta
  if (lastUsedStep != null && step <= lastUsedStep) return null
  return step
}
