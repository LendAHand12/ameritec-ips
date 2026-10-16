import api from '@/lib/api'

export const getAccount = () => api.get('/account')
export const getSession = () => api.get('/account/session')
export const updatePhone = (data) => api.patch('/account/phone', data)
export const changePassword = (data) => api.post('/account/password', data)
export function submitFace(file) {
  const form = new FormData()
  form.append('face', file)
  return api.post('/account/face', form)
}
export const setupTwoFactor = (password) => api.post('/account/2fa/setup', { password })
export const enableTwoFactor = (setupToken, code) => api.post('/account/2fa/enable', { setupToken, code })
export const disableTwoFactor = (password, code) => api.post('/account/2fa/disable', { password, code })
export const signOutOtherSessions = () => api.post('/account/sessions/revoke-others')
