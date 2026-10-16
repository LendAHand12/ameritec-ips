import api from '@/lib/api'

export const checkAccountInfo = (data) => api.post('/auth/register/check', data)

export const setupTwoFactor = (email) => api.post('/auth/register/2fa/setup', { email })

export const verifyTwoFactorSetup = (setupToken, code) => api.post('/auth/register/2fa/verify', { setupToken, code })

export function register({ account, identity, twoFactor, face }) {
  const form = new FormData()
  for (const [key, value] of Object.entries(account)) {
    if (value) form.append(key, value)
  }
  form.append('documentType', identity.documentType)
  form.append('documentFront', identity.front)
  form.append('documentBack', identity.back)
  if (identity.supporting) form.append('supportingDocument', identity.supporting)
  // Both are optional at sign-up: two-factor and the face scan can be added later
  if (twoFactor?.twoFactorToken) form.append('twoFactorToken', twoFactor.twoFactorToken)
  if (face?.file) form.append('face', face.file)
  return api.post('/auth/register', form)
}

export const verifyEmail = (email, code) => api.post('/auth/verify-email', { email, code })

export const resendVerification = (email) => api.post('/auth/resend-verification', { email })

export const forgotPassword = (email) => api.post('/auth/forgot-password', { email })

export const resetPassword = (data) => api.post('/auth/reset-password', data)

export const login = (data) => api.post('/auth/login', data)

export const loginTwoFactor = (loginToken, code) => api.post('/auth/login/2fa', { loginToken, code })

export const logout = () => api.post('/auth/logout')

export const getMe = () => api.get('/auth/me')
