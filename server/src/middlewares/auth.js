import Admin from '../models/Admin.js'
import User, { ACCOUNT_STATUS, USER_STATUS } from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { TOKEN_PURPOSE, verifyToken } from '../utils/tokens.js'

export const SESSION_COOKIE = 'token'
export const ADMIN_SESSION_COOKIE = 'admin_token'

export async function protect(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) throw new ApiError(401, 'Not authenticated', undefined, 'UNAUTHENTICATED')

  const { sub, iat } = verifyToken(token, TOKEN_PURPOSE.SESSION, { code: 'UNAUTHENTICATED', message: 'Session expired' })
  const user = await User.findById(sub)
  // A password reset invalidates every session issued before it
  const invalidatedAt = Math.max(user?.passwordChangedAt?.getTime() ?? 0, user?.sessionsRevokedAt?.getTime() ?? 0)
  const passwordChanged = invalidatedAt && iat < Math.floor(invalidatedAt / 1000)
  // No admin approval needed to sign in: the face scan review only gates commission withdrawals
  if (!user || user.deletedAt || passwordChanged || !user.emailVerified || user.status === USER_STATUS.REJECTED || user.accountStatus === ACCOUNT_STATUS.LOCKED) {
    res.clearCookie(SESSION_COOKIE)
    throw new ApiError(401, 'Not authenticated', undefined, 'UNAUTHENTICATED')
  }

  req.user = user
  next()
}

/** Route guard (after protectAdmin): super admins pass, sub admins need the permission. */
export const requirePermission = (permission) => (req, res, next) => {
  if (!req.admin.can(permission)) throw new ApiError(403, 'You do not have permission to do this', undefined, 'FORBIDDEN')
  next()
}

export function requireSuperAdmin(req, res, next) {
  if (!req.admin.isSuperAdmin()) throw new ApiError(403, 'Only a super admin can manage admin accounts', undefined, 'FORBIDDEN')
  next()
}

/** Admin sessions use their own cookie and token purpose — a customer session can never reach admin routes. */
export async function protectAdmin(req, res, next) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE]
  if (!token) throw new ApiError(401, 'Not authenticated', undefined, 'ADMIN_UNAUTHENTICATED')

  const { sub } = verifyToken(token, TOKEN_PURPOSE.ADMIN_SESSION, {
    code: 'ADMIN_UNAUTHENTICATED',
    message: 'Session expired',
  })
  const admin = await Admin.findById(sub)
  if (!admin?.isActive) {
    res.clearCookie(ADMIN_SESSION_COOKIE)
    throw new ApiError(401, 'Not authenticated', undefined, 'ADMIN_UNAUTHENTICATED')
  }

  req.admin = admin
  next()
}
