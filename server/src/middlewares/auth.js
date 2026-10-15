import Admin from '../models/Admin.js'
import User, { ACCOUNT_STATUS, USER_STATUS } from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { TOKEN_PURPOSE, verifyToken } from '../utils/tokens.js'

export const SESSION_COOKIE = 'token'
export const ADMIN_SESSION_COOKIE = 'admin_token'

export async function protect(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) throw new ApiError(401, 'Not authenticated', undefined, 'UNAUTHENTICATED')

  const { sub } = verifyToken(token, TOKEN_PURPOSE.SESSION, { code: 'UNAUTHENTICATED', message: 'Session expired' })
  const user = await User.findById(sub)
  if (!user || !user.emailVerified || user.status !== USER_STATUS.APPROVED || user.accountStatus === ACCOUNT_STATUS.LOCKED) {
    res.clearCookie(SESSION_COOKIE)
    throw new ApiError(401, 'Not authenticated', undefined, 'UNAUTHENTICATED')
  }

  req.user = user
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
