import crypto from 'crypto'
import ApiError from '../utils/ApiError.js'
import { sendPasswordResetCodeEmail } from './mail.service.js'

const CODE_TTL_MINUTES = 15
export const RESEND_COOLDOWN_SECONDS = 60
const MAX_ATTEMPTS = 5

// Bound to the user and the purpose so a verification code can never reset a password
const hashCode = (userId, code) => crypto.createHash('sha256').update(`password-reset:${userId}:${code}`).digest('hex')

/**
 * Emails a reset code. Never reveals whether the account exists: unknown accounts, cooldowns and
 * mail failures all look the same to the caller. `user` must include +passwordReset (or be null).
 */
export async function issuePasswordResetCode(user) {
  if (!user) return
  const lastSentAt = user.passwordReset?.lastSentAt
  if (lastSentAt && Date.now() - lastSentAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) return

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  user.passwordReset = {
    codeHash: hashCode(user._id, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    attempts: 0,
    lastSentAt: new Date(),
  }
  await user.save()

  try {
    await sendPasswordResetCodeEmail(user, code, CODE_TTL_MINUTES)
  } catch (err) {
    console.error('Failed to send password reset email:', err.code ?? '', err.response ?? err.message)
  }
}

/** Checks the code and sets the new password. `user` must include +passwordReset and +password. */
export async function resetPasswordWithCode(user, code, newPassword) {
  const pr = user?.passwordReset
  const invalid = () => new ApiError(400, 'Incorrect code', { code: 'Incorrect code' }, 'CODE_INVALID')
  if (!pr?.codeHash) throw invalid()
  if (pr.expiresAt < new Date()) throw new ApiError(400, 'Code has expired, please request a new one', { code: 'Code has expired' }, 'CODE_EXPIRED')
  if (pr.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(400, 'Too many incorrect attempts, please request a new code', { code: 'Too many attempts' }, 'CODE_LOCKED')
  }

  const expected = Buffer.from(pr.codeHash, 'hex')
  const actual = Buffer.from(hashCode(user._id, code), 'hex')
  if (!crypto.timingSafeEqual(expected, actual)) {
    pr.attempts += 1
    await user.save()
    throw invalid()
  }

  user.password = newPassword
  user.passwordChangedAt = new Date() // signs out every session issued before now
  user.passwordReset = undefined
  await user.save()
}
