import crypto from 'crypto'
import ApiError from '../utils/ApiError.js'
import { sendVerificationCodeEmail } from './mail.service.js'

const CODE_TTL_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 60
const MAX_ATTEMPTS = 5

const hashCode = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex')

/** Generates a new code, stores its hash on the user and emails it. `user` must include +emailVerification. */
export async function issueVerificationCode(user, { enforceCooldown = true } = {}) {
  const lastSentAt = user.emailVerification?.lastSentAt
  if (enforceCooldown && lastSentAt) {
    const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - (Date.now() - lastSentAt.getTime()) / 1000)
    if (waitSeconds > 0) {
      throw new ApiError(429, `Please wait ${waitSeconds}s before requesting a new code`, { retryAfter: waitSeconds }, 'RESEND_COOLDOWN')
    }
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const previous = user.emailVerification
  user.emailVerification = {
    codeHash: hashCode(user._id, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    attempts: 0,
    lastSentAt: new Date(),
  }
  await user.save()

  try {
    await sendVerificationCodeEmail(user, code, CODE_TTL_MINUTES)
  } catch (err) {
    console.error('Failed to send verification email:', err.code ?? '', err.response ?? err.message)
    // Nothing was delivered: restore the previous code and don't start the resend cooldown
    user.emailVerification = previous
    await user.save()
    throw new ApiError(502, "We couldn't send the email right now. Please try again in a moment.", undefined, 'EMAIL_SEND_FAILED')
  }

  return { resendAfter: RESEND_COOLDOWN_SECONDS }
}

/** Checks the code and marks the email as verified. `user` must include +emailVerification. */
export async function confirmVerificationCode(user, code) {
  const ev = user.emailVerification
  if (!ev?.codeHash || ev.expiresAt < new Date()) {
    throw new ApiError(400, 'Code has expired, please request a new one', undefined, 'CODE_EXPIRED')
  }
  if (ev.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(400, 'Too many incorrect attempts, please request a new code', undefined, 'CODE_LOCKED')
  }

  const expected = Buffer.from(ev.codeHash, 'hex')
  const actual = Buffer.from(hashCode(user._id, code), 'hex')
  if (!crypto.timingSafeEqual(expected, actual)) {
    ev.attempts += 1
    await user.save()
    throw new ApiError(400, 'Incorrect code', { code: 'Incorrect code' }, 'CODE_INVALID')
  }

  user.emailVerified = true
  user.emailVerifiedAt = new Date()
  user.emailVerification = undefined
  await user.save()
}
