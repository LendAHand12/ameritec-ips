import jwt from 'jsonwebtoken'
import env from '../config/env.js'
import ApiError from './ApiError.js'

// Every token carries a purpose so one kind can never be used in place of another
export const TOKEN_PURPOSE = {
  SESSION: 'session',
  ADMIN_SESSION: 'admin_session',
  TWO_FACTOR_SETUP: '2fa_setup',
  TWO_FACTOR_VERIFIED: '2fa_verified',
  LOGIN_2FA: 'login_2fa',
  FACE_SCAN: 'face_scan',
}

export function signToken(purpose, payload, expiresIn) {
  return jwt.sign({ ...payload, purpose }, env.jwt.secret, { expiresIn })
}

export function verifyToken(token, purpose, { code = 'INVALID_TOKEN', message = 'Invalid or expired token' } = {}) {
  try {
    const payload = jwt.verify(token, env.jwt.secret)
    if (payload.purpose !== purpose) throw new Error('Wrong token purpose')
    return payload
  } catch {
    throw new ApiError(401, message, undefined, code)
  }
}
