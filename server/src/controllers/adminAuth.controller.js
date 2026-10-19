import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import env from '../config/env.js'
import Admin from '../models/Admin.js'
import ApiError from '../utils/ApiError.js'
import { TOKEN_PURPOSE, signToken, verifyToken } from '../utils/tokens.js'
import { ADMIN_SESSION_COOKIE } from '../middlewares/auth.js'
import { describeAudit } from '../services/audit.service.js'
import { generateTwoFactorSecret, verifyTwoFactorCode } from '../services/twoFactor.service.js'

// Compared against when the account doesn't exist so response time doesn't reveal it
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12)

export async function login(req, res) {
  const { email, password } = req.body

  const admin = await Admin.findOne({ email }).select('+password')
  const passwordOk = admin ? await admin.comparePassword(password) : await bcrypt.compare(password, DUMMY_HASH).then(() => false)
  if (!admin || !passwordOk || !admin.isActive) {
    describeAudit(req, {
      action: 'admin.login_failed',
      actor: admin ?? undefined,
      actorEmail: email,
      description: !admin ? 'Unknown email' : !admin.isActive ? 'Account disabled' : 'Wrong password',
    })
    throw new ApiError(401, 'Incorrect email or password', undefined, 'INVALID_CREDENTIALS')
  }

  // Two-factor on: the password alone doesn't sign in, a code from the authenticator app is needed next
  if (admin.twoFactor?.enabled) {
    describeAudit(req, { actor: admin, record: { type: 'admin', id: admin.id, ref: admin.email }, description: 'Password accepted, waiting for the two-factor code' })
    const loginToken = signToken(TOKEN_PURPOSE.ADMIN_LOGIN_2FA, { sub: admin.id }, '5m')
    return res.json({ requiresTwoFactor: true, loginToken })
  }

  describeAudit(req, { actor: admin, record: { type: 'admin', id: admin.id, ref: admin.email } })
  await startSession(res, admin)
}

async function startSession(res, admin) {
  admin.lastLoginAt = new Date()
  await admin.save()

  const token = signToken(TOKEN_PURPOSE.ADMIN_SESSION, { sub: admin.id }, env.adminJwtExpiresIn)
  const { exp } = jwt.decode(token)
  res.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    maxAge: exp * 1000 - Date.now(),
  })
  res.json({ admin })
}

/** Second step of sign-in for admins with two-factor on. */
export async function loginTwoFactor(req, res) {
  const { sub } = verifyToken(req.body.loginToken, TOKEN_PURPOSE.ADMIN_LOGIN_2FA, { code: 'LOGIN_EXPIRED', message: 'Login session expired, please sign in again' })
  const admin = await Admin.findById(sub).select('+twoFactor.secret +twoFactor.lastUsedStep')
  if (!admin?.isActive || !admin.twoFactor?.enabled) throw new ApiError(401, 'Login session expired, please sign in again', undefined, 'LOGIN_EXPIRED')
  const step = verifyTwoFactorCode(admin.twoFactor.secret, req.body.code, admin.twoFactor.lastUsedStep)
  if (step === null) {
    describeAudit(req, { action: 'admin.login_failed', actor: admin, actorEmail: admin.email, description: 'Wrong two-factor code' })
    throw new ApiError(400, 'Incorrect code', { code: 'Incorrect code' }, 'CODE_INVALID')
  }
  admin.twoFactor.lastUsedStep = step
  describeAudit(req, { actor: admin, record: { type: 'admin', id: admin.id, ref: admin.email } })
  await startSession(res, admin)
}

export async function logout(req, res) {
  // Identify who is signing out for the audit log; an expired session just logs out anonymously
  try {
    const { sub } = verifyToken(req.cookies?.[ADMIN_SESSION_COOKIE], TOKEN_PURPOSE.ADMIN_SESSION)
    const admin = await Admin.findById(sub)
    if (admin) describeAudit(req, { actor: admin, record: { type: 'admin', id: admin.id, ref: admin.email } })
  } catch {
    req.audit = { skip: true } // no known admin, nothing to record
  }
  res.clearCookie(ADMIN_SESSION_COOKIE)
  res.json({ message: 'Logged out' })
}

export function me(req, res) {
  res.json({ admin: req.admin })
}

// ---- Two-factor for the signed-in admin (each admin turns it on or off for their own account) ----

const wrongPassword = () => new ApiError(400, 'Incorrect password', { password: 'Incorrect password' }, 'PASSWORD_INVALID')

/** Step 1: confirm the password, get a QR code + secret. Nothing is saved until a code is verified. */
export async function setupTwoFactor(req, res) {
  const admin = await Admin.findById(req.admin._id).select('+password')
  if (admin.twoFactor?.enabled) throw new ApiError(409, 'Two-factor authentication is already on')
  if (!(await admin.comparePassword(req.body.password))) throw wrongPassword()
  const { secret, qrCode } = await generateTwoFactorSecret(admin.email)
  const setupToken = signToken(TOKEN_PURPOSE.TWO_FACTOR_SETUP, { sub: admin.id, secret, admin: true }, '15m')
  res.json({ secret, qrCode, setupToken })
}

/** Step 2: a valid code from the authenticator app turns it on. */
export async function enableTwoFactor(req, res) {
  const { sub, secret, admin: isAdminToken } = verifyToken(req.body.setupToken, TOKEN_PURPOSE.TWO_FACTOR_SETUP, { code: 'TWO_FACTOR_SETUP_EXPIRED', message: 'Setup expired, please start again' })
  if (!isAdminToken || sub !== req.admin.id) throw new ApiError(400, 'Setup expired, please start again', undefined, 'TWO_FACTOR_SETUP_EXPIRED')
  const step = verifyTwoFactorCode(secret, req.body.code)
  if (step === null) throw new ApiError(400, 'Incorrect code', { code: 'Incorrect code' }, 'CODE_INVALID')
  const admin = await Admin.findById(req.admin._id)
  admin.twoFactor = { enabled: true, secret, lastUsedStep: step }
  await admin.save()
  describeAudit(req, { record: { type: 'admin', id: admin.id, ref: admin.email } })
  res.json({ admin })
}

/** Turning it off needs the password and a current code, so a stolen session can't weaken the account. */
export async function disableTwoFactor(req, res) {
  const admin = await Admin.findById(req.admin._id).select('+password +twoFactor.secret +twoFactor.lastUsedStep')
  if (!admin.twoFactor?.enabled) throw new ApiError(409, 'Two-factor authentication is already off')
  if (!(await admin.comparePassword(req.body.password))) throw wrongPassword()
  const step = verifyTwoFactorCode(admin.twoFactor.secret, req.body.code, admin.twoFactor.lastUsedStep)
  if (step === null) throw new ApiError(400, 'Incorrect or already used code', { code: 'Incorrect or already used code' }, 'CODE_INVALID')
  admin.twoFactor = { enabled: false }
  await admin.save()
  describeAudit(req, { record: { type: 'admin', id: admin.id, ref: admin.email } })
  res.json({ admin })
}
