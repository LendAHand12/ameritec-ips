import jwt from 'jsonwebtoken'
import env from '../config/env.js'
import User, { FACE_STATUS } from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { ensureApplicationId } from '../utils/applicationId.js'
import { maskEmail, maskPhone } from '../utils/mask.js'
import { normalizePhone } from '../utils/normalize.js'
import { SESSION_COOKIE } from '../middlewares/auth.js'
import { TOKEN_PURPOSE, signToken, verifyToken } from '../utils/tokens.js'
import { generateTwoFactorSecret, verifyTwoFactorCode } from '../services/twoFactor.service.js'
import { assertSensitiveAuth, assertTwoFactor } from '../services/withdrawal.service.js'

const REMEMBER_ME_EXPIRES_IN = '30d'

/**
 * Gives this device a brand-new session cookie. Used after something invalidated older sessions
 * (password change, "sign out everywhere"), so the person doing it isn't thrown out too.
 */
function reissueSession(req, res, user) {
  const old = jwt.decode(req.cookies?.[SESSION_COOKIE] ?? '')
  // A "remember me" login lasts 30 days: keep that promise
  const remember = !!old && old.exp - old.iat >= 29 * 24 * 60 * 60
  const token = signToken(TOKEN_PURPOSE.SESSION, { sub: user.id }, remember ? REMEMBER_ME_EXPIRES_IN : env.jwt.expiresIn)
  const { exp } = jwt.decode(token)
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    ...(remember && { maxAge: exp * 1000 - Date.now() }),
  })
}

/** Profile + security facts for the Account & Security page. Email and phone come back masked. */
export async function getAccount(req, res) {
  const user = req.user
  await ensureApplicationId(user)
  res.json({
    profile: {
      fullName: user.fullName,
      email: maskEmail(user.email),
      phone: maskPhone(user.phone),
      phoneCountry: user.phoneCountry ?? null,
      applicationId: user.applicationId,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
      status: user.status,
      accountStatus: user.accountStatus,
      emailVerified: !!user.emailVerified,
    },
    identity: {
      documentType: user.identity?.documentType ?? null,
      submittedAt: user.emailVerifiedAt ?? user.createdAt,
      reviewedAt: user.reviewedAt ?? null,
      faceVerified: !!user.faceVerified,
      // Optional at sign-up: "none" until the person adds one, then pending → approved / rejected by an admin
      face: {
        status: user.faceVerified ? FACE_STATUS.APPROVED : (user.face?.status ?? FACE_STATUS.NONE),
        submittedAt: user.face?.submittedAt ?? null,
        reviewedAt: user.face?.reviewedAt ?? null,
        rejectionReason: user.face?.status === FACE_STATUS.REJECTED ? (user.face?.rejectionReason ?? null) : null,
      },
    },
    security: {
      twoFactorEnabled: !!user.twoFactor?.enabled,
      passwordChangedAt: user.passwordChangedAt ?? null,
    },
  })
}

/** Changes the phone number used for sign-in. Needs a fresh authenticator code. */
export async function updatePhone(req, res) {
  const { phoneCountry, phoneNumber } = req.body
  const phone = normalizePhone(phoneNumber, phoneCountry)
  if (!phone) throw new ApiError(400, 'Invalid phone number', { phoneNumber: 'Invalid phone number' })
  if (phone === req.user.phone) throw new ApiError(400, 'That is already your phone number', { phoneNumber: 'Same as your current number' })
  if (await User.exists({ phone, _id: { $ne: req.user._id } })) {
    throw new ApiError(409, 'Phone number is already registered', { phoneNumber: 'Phone number is already registered' })
  }

  await assertSensitiveAuth(req.user._id, req.body)
  const user = await User.findById(req.user._id)
  user.phone = phone
  user.phoneCountry = phoneCountry
  await user.save()
  res.json({ phone: maskPhone(user.phone) })
}

/** Needs the current password and an authenticator code; every other device is signed out. */
export async function changePassword(req, res) {
  const { currentPassword, newPassword, code } = req.body
  const user = await User.findById(req.user._id).select('+password')
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Incorrect current password', { currentPassword: 'Incorrect password' }, 'WRONG_PASSWORD')
  }
  if (await user.comparePassword(newPassword)) {
    throw new ApiError(400, 'Choose a password you haven’t used just now', { newPassword: 'Same as your current password' })
  }

  // The current password was just checked, so users without two-factor have nothing more to prove
  await assertSensitiveAuth(user._id, { code, password: currentPassword })
  const fresh = await User.findById(user._id).select('+password')
  fresh.password = newPassword
  fresh.passwordChangedAt = new Date()
  await fresh.save()
  reissueSession(req, res, fresh)
  res.json({ passwordChangedAt: fresh.passwordChangedAt })
}

/** The session this request belongs to (we don't keep a device list: sessions are signed tokens). */
export function getSession(req, res) {
  const payload = jwt.decode(req.cookies?.[SESSION_COOKIE] ?? '')
  res.json({
    current: {
      signedInAt: payload?.iat ? new Date(payload.iat * 1000) : null,
      expiresAt: payload?.exp ? new Date(payload.exp * 1000) : null,
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null,
    },
  })
}

/** Signs out every other device, keeping this one. */
export async function signOutOtherSessions(req, res) {
  const user = await User.findById(req.user._id)
  user.sessionsRevokedAt = new Date()
  await user.save()
  reissueSession(req, res, user)
  res.json({ revokedAt: user.sessionsRevokedAt })
}

// ---- Two-factor authentication (optional: switch it on or off from here) ----

/** Step 1: confirm the password, get a QR code + secret. Nothing is saved until the code is verified. */
export async function setupTwoFactor(req, res) {
  const user = await User.findById(req.user._id).select('+password')
  if (user.twoFactor?.enabled) throw new ApiError(409, 'Two-factor authentication is already on')
  if (!(await user.comparePassword(req.body.password))) {
    throw new ApiError(400, 'Incorrect password', { password: 'Incorrect password' }, 'PASSWORD_INVALID')
  }
  const { secret, qrCode } = await generateTwoFactorSecret(user.email)
  const setupToken = signToken(TOKEN_PURPOSE.TWO_FACTOR_SETUP, { sub: user.id, secret }, '15m')
  res.json({ secret, qrCode, setupToken })
}

/** Step 2: a valid code from the authenticator app turns it on. */
export async function enableTwoFactor(req, res) {
  const { sub, secret } = verifyToken(req.body.setupToken, TOKEN_PURPOSE.TWO_FACTOR_SETUP, {
    code: 'TWO_FACTOR_SETUP_EXPIRED',
    message: 'Setup expired, please start again',
  })
  if (sub !== req.user.id) throw new ApiError(400, 'Setup expired, please start again', undefined, 'TWO_FACTOR_SETUP_EXPIRED')
  const step = verifyTwoFactorCode(secret, req.body.code)
  if (step === null) throw new ApiError(400, 'Incorrect code', { code: 'Incorrect code' }, 'CODE_INVALID')

  const user = await User.findById(req.user._id)
  user.twoFactor = { enabled: true, secret, lastUsedStep: step }
  await user.save()
  res.json({ twoFactorEnabled: true })
}

/** Turning it off needs the password and a current code, so a stolen session can't weaken the account. */
export async function disableTwoFactor(req, res) {
  const user = await User.findById(req.user._id).select('+password')
  if (!user.twoFactor?.enabled) throw new ApiError(409, 'Two-factor authentication is already off')
  if (!(await user.comparePassword(req.body.password))) {
    throw new ApiError(400, 'Incorrect password', { password: 'Incorrect password' }, 'PASSWORD_INVALID')
  }
  await assertTwoFactor(user._id, req.body.code)
  const fresh = await User.findById(user._id)
  fresh.twoFactor = { enabled: false }
  await fresh.save()
  res.json({ twoFactorEnabled: false })
}
