import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import env from '../config/env.js'
import Admin from '../models/Admin.js'
import ApiError from '../utils/ApiError.js'
import { TOKEN_PURPOSE, signToken, verifyToken } from '../utils/tokens.js'
import { ADMIN_SESSION_COOKIE } from '../middlewares/auth.js'
import { describeAudit } from '../services/audit.service.js'

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

  describeAudit(req, { actor: admin, record: { type: 'admin', id: admin.id, ref: admin.email } })
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
