import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import env from '../config/env.js'
import User, { ACCOUNT_STATUS, FACE_STATUS, USER_STATUS } from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { normalizePhone } from '../utils/normalize.js'
import { applicationSummary, nextApplicationId } from '../utils/applicationId.js'
import { TOKEN_PURPOSE, signToken, verifyToken } from '../utils/tokens.js'
import { SESSION_COOKIE } from '../middlewares/auth.js'
import { generateTwoFactorSecret, verifyTwoFactorCode } from '../services/twoFactor.service.js'
import { confirmVerificationCode, issueVerificationCode } from '../services/emailVerification.service.js'
import { RESEND_COOLDOWN_SECONDS, issuePasswordResetCode, resetPasswordWithCode } from '../services/passwordReset.service.js'

// Compared against when the account doesn't exist so response time doesn't reveal it
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12)

/** Checks phone validity, email/phone uniqueness and the referral code. Throws with per-field details. */
async function assertAccountInfoAvailable({ email, phoneCountry, phoneNumber, referralCode }) {
  const details = {}

  const phone = normalizePhone(phoneNumber, phoneCountry)
  if (!phone) details.phoneNumber = 'Invalid phone number'

  const [emailTaken, phoneTaken, referrer] = await Promise.all([
    User.exists({ email }),
    phone ? User.exists({ phone }) : null,
    referralCode ? User.findOne({ referralCode, deletedAt: null }).select('_id fullName') : null,
  ])

  if (emailTaken) details.email = 'Email is already registered'
  if (phoneTaken) details.phoneNumber = 'Phone number is already registered'
  if (referralCode && !referrer) details.referralCode = 'Referral code does not exist'

  if (Object.keys(details).length) {
    throw new ApiError(409, Object.values(details)[0], details, 'ACCOUNT_INFO_INVALID')
  }
  return { phone, referrer }
}

const REMEMBER_ME_EXPIRES_IN = '30d'

/**
 * "Remember me" → persistent cookie for 30 days.
 * Otherwise a browser-session cookie (cleared when the browser closes), token still capped by JWT_EXPIRES_IN.
 */
function startSession(res, user, { remember = false } = {}) {
  const token = signToken(TOKEN_PURPOSE.SESSION, { sub: user.id }, remember ? REMEMBER_ME_EXPIRES_IN : env.jwt.expiresIn)
  const { exp } = jwt.decode(token)
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    ...(remember && { maxAge: exp * 1000 - Date.now() }),
  })
  res.json({ user })
}

// ---- Registration ----

export async function checkAccountInfo(req, res) {
  const { referrer } = await assertAccountInfoAvailable(req.body)
  res.json({ valid: true, referrer: referrer ? { fullName: referrer.fullName } : null })
}

export async function setupTwoFactor(req, res) {
  const { email } = req.body
  const { secret, qrCode, otpauthUrl } = await generateTwoFactorSecret(email)
  const setupToken = signToken(TOKEN_PURPOSE.TWO_FACTOR_SETUP, { email, secret }, '30m')
  res.json({ secret, qrCode, otpauthUrl, setupToken })
}

export async function verifyTwoFactorSetup(req, res) {
  const { setupToken, code } = req.body
  const { email, secret } = verifyToken(setupToken, TOKEN_PURPOSE.TWO_FACTOR_SETUP, {
    code: 'TWO_FACTOR_SETUP_EXPIRED',
    message: 'Two-factor setup expired, please start again',
  })

  if (verifyTwoFactorCode(secret, code) === null) {
    throw new ApiError(400, 'Incorrect code', { code: 'Incorrect code' }, 'CODE_INVALID')
  }

  const twoFactorToken = signToken(TOKEN_PURPOSE.TWO_FACTOR_VERIFIED, { email, secret }, '2h')
  res.json({ twoFactorToken })
}

export async function register(req, res) {
  const data = req.body
  const front = req.files?.documentFront?.[0]
  const back = req.files?.documentBack?.[0]
  const supporting = req.files?.supportingDocument?.[0]
  const face = req.files?.face?.[0]
  if (!front || !back) {
    const details = {}
    if (!front) details.documentFront = 'Front image is required'
    if (!back) details.documentBack = 'Back image is required'
    throw new ApiError(400, Object.values(details)[0], details, 'VALIDATION_ERROR')
  }

  // Two-factor is optional: only enabled when the person finished the setup step
  let twoFactor = null
  if (data.twoFactorToken) {
    twoFactor = verifyToken(data.twoFactorToken, TOKEN_PURPOSE.TWO_FACTOR_VERIFIED, {
      code: 'TWO_FACTOR_SETUP_EXPIRED',
      message: 'Two-factor setup expired, please set it up again',
    })
    if (twoFactor.email !== data.email) {
      throw new ApiError(400, 'Two-factor setup does not match this email, please set it up again', undefined, 'TWO_FACTOR_SETUP_EXPIRED')
    }
  }

  const { phone, referrer } = await assertAccountInfoAvailable(data)

  const user = new User({
    fullName: data.fullName,
    email: data.email,
    phone,
    phoneCountry: data.phoneCountry,
    password: data.password,
    referredBy: referrer?._id ?? null,
    identity: {
      documentType: data.documentType,
      frontImage: front.filename,
      backImage: back.filename,
      supportingImage: supporting?.filename,
    },
    twoFactor: twoFactor ? { enabled: true, secret: twoFactor.secret } : { enabled: false },
    // An optional face scan waits for an admin to approve it
    face: face ? { status: FACE_STATUS.PENDING, image: face.filename, submittedAt: new Date() } : { status: FACE_STATUS.NONE },
    termsAcceptedAt: new Date(),
    applicationId: await nextApplicationId(),
  })

  await user.save()

  let emailSent = true
  try {
    await issueVerificationCode(user, { enforceCooldown: false })
  } catch (err) {
    if (err.code !== 'EMAIL_SEND_FAILED') throw err
    emailSent = false
  }

  res.status(201).json({ email: user.email, emailSent })
}

// ---- Email verification ----

export async function verifyEmail(req, res) {
  const { email, code } = req.body
  const user = await User.findOne({ email }).select('+emailVerification')
  if (!user) throw new ApiError(400, 'Incorrect code', { code: 'Incorrect code' }, 'CODE_INVALID')
  if (user.emailVerified) throw new ApiError(400, 'Email is already verified', undefined, 'ALREADY_VERIFIED')

  await confirmVerificationCode(user, code)
  res.json(await applicationSummary(user))
}

export async function resendVerification(req, res) {
  const { email } = req.body
  const user = await User.findOne({ email }).select('+emailVerification')
  // Same response whether the account exists or not
  if (!user || user.emailVerified) return res.json({ resendAfter: 60 })

  const result = await issueVerificationCode(user)
  res.json(result)
}

// ---- Password reset ----

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email, deletedAt: null }).select('+passwordReset')
  await issuePasswordResetCode(user)
  // Same answer whether or not the account exists
  res.json({ resendAfter: RESEND_COOLDOWN_SECONDS })
}

export async function resetPassword(req, res) {
  const { email, code, password } = req.body
  const user = await User.findOne({ email, deletedAt: null }).select('+passwordReset +password')
  await resetPasswordWithCode(user, code, password)
  res.json({ message: 'Password updated' })
}

// ---- Login ----

export async function login(req, res) {
  const { method, password, remember } = req.body
  const query =
    method === 'email'
      ? { email: req.body.email }
      : { phone: normalizePhone(req.body.phoneNumber, req.body.phoneCountry) ?? '__invalid__' }

  const user = await User.findOne(query).select('+password')
  const passwordOk = user ? await user.comparePassword(password) : await bcrypt.compare(password, DUMMY_HASH).then(() => false)
  if (!user || !passwordOk) {
    throw new ApiError(401, 'Incorrect email/phone number or password', undefined, 'INVALID_CREDENTIALS')
  }

  if (user.accountStatus === ACCOUNT_STATUS.LOCKED) {
    throw new ApiError(403, 'Your account has been locked. Please contact support.', undefined, 'ACCOUNT_LOCKED')
  }
  if (!user.emailVerified) {
    throw new ApiError(403, 'Please verify your email address', { email: user.email }, 'EMAIL_NOT_VERIFIED')
  }
  // Password was correct, so it's safe to tell the applicant where their application stands
  if (user.status === USER_STATUS.PENDING) {
    throw new ApiError(403, 'Your account is waiting for admin approval', await applicationSummary(user), 'ACCOUNT_PENDING')
  }
  if (user.status === USER_STATUS.REJECTED) {
    throw new ApiError(403, 'Your account application was not approved', await applicationSummary(user), 'ACCOUNT_REJECTED')
  }

  if (user.twoFactor?.enabled) {
    const loginToken = signToken(TOKEN_PURPOSE.LOGIN_2FA, { sub: user.id, remember }, '5m')
    return res.json({ requiresTwoFactor: true, loginToken })
  }

  startSession(res, user, { remember })
}

export async function loginTwoFactor(req, res) {
  const { loginToken, code } = req.body
  const { sub, remember } = verifyToken(loginToken, TOKEN_PURPOSE.LOGIN_2FA, {
    code: 'LOGIN_EXPIRED',
    message: 'Login session expired, please sign in again',
  })

  const user = await User.findById(sub).select('+twoFactor.secret +twoFactor.lastUsedStep')
  if (!user || user.status !== USER_STATUS.APPROVED || user.accountStatus === ACCOUNT_STATUS.LOCKED) {
    throw new ApiError(401, 'Login session expired, please sign in again', undefined, 'LOGIN_EXPIRED')
  }

  const step = verifyTwoFactorCode(user.twoFactor.secret, code, user.twoFactor.lastUsedStep)
  if (step === null) throw new ApiError(400, 'Incorrect code', { code: 'Incorrect code' }, 'CODE_INVALID')

  user.twoFactor.lastUsedStep = step
  await user.save()

  startSession(res, user, { remember })
}

export function logout(req, res) {
  res.clearCookie(SESSION_COOKIE)
  res.json({ message: 'Logged out' })
}

export function me(req, res) {
  res.json({ user: req.user })
}
