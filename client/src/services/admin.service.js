import api from '@/lib/api'

// Auth
export const adminLogin = (data) => api.post('/admin/auth/login', data)
export const adminLogout = () => api.post('/admin/auth/logout')
export const getAdminMe = () => api.get('/admin/auth/me')

// Users & KYC
export const listUsers = (params) => api.get('/admin/users', { params })
export const getUserStats = () => api.get('/admin/users/stats')
export const getUser = (id) => api.get(`/admin/users/${id}`)
export const approveUser = (id) => api.patch(`/admin/users/${id}/approve`)
export const rejectUser = (id, reason) => api.patch(`/admin/users/${id}/reject`, { reason })
export const lockUser = (id, reason) => api.patch(`/admin/users/${id}/lock`, { reason })
export const unlockUser = (id) => api.patch(`/admin/users/${id}/unlock`)
export const identityImageUrl = (id, side) => `${import.meta.env.VITE_API_URL ?? ''}/api/admin/users/${id}/identity/${side}`

/** Downloads the CSV for the given filters (or the selected ids). */
export async function exportUsers(params) {
  const blob = await api.get('/admin/users/export', { params, responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `users-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

// Orders
export const listAdminOrders = (params) => api.get('/admin/orders', { params })
export const getOrderStats = () => api.get('/admin/orders/stats')
export const getAdminOrder = (id) => api.get(`/admin/orders/${id}`)
export const approveOrder = (id) => api.patch(`/admin/orders/${id}/approve`)
export const rejectOrder = (id, reason) => api.patch(`/admin/orders/${id}/reject`, { reason })
export function uploadCertificate(id, file) {
  const form = new FormData()
  form.append('certificate', file)
  return api.post(`/admin/orders/${id}/certificate`, form)
}
export const adminCertificateUrl = (id) => `${import.meta.env.VITE_API_URL ?? ''}/api/admin/orders/${id}/certificate`

// Operational parameters
export const getSettings = () => api.get('/admin/settings')
export const updateSettings = (data) => api.put('/admin/settings', data)
export function uploadZelleQr(file) {
  const form = new FormData()
  form.append('qr', file)
  return api.post('/admin/settings/zelle-qr', form)
}
export const adminZelleQrUrl = () => `${import.meta.env.VITE_API_URL ?? ''}/api/admin/settings/zelle-qr`

// Support
export const listSupportTickets = (params) => api.get('/admin/support/tickets', { params })
export const getSupportStats = () => api.get('/admin/support/tickets/stats')
export const listSupportAgents = () => api.get('/admin/support/agents')
export const listSupportArticles = (params) => api.get('/admin/support/articles', { params })
export const createSupportArticle = (data) => api.post('/admin/support/articles', data)
export const updateSupportArticle = (id, data) => api.put(`/admin/support/articles/${id}`, data)
export const deleteSupportArticle = (id) => api.delete(`/admin/support/articles/${id}`)

// Audit logs
export const listAuditLogs = (params) => api.get('/admin/audit-logs', { params })
export const getAuditStats = (params) => api.get('/admin/audit-logs/stats', { params })
export const getAuditMeta = () => api.get('/admin/audit-logs/meta')
export const getAuditLog = (id) => api.get(`/admin/audit-logs/${id}`)
export async function exportAuditLogs(params) {
  const blob = await api.get('/admin/audit-logs/export', { params, responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `audit-logs-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}
export const getSupportTicket = (id) => api.get(`/admin/support/tickets/${id}`)
export const updateSupportTicket = (id, data) => api.patch(`/admin/support/tickets/${id}`, data)
export const addSupportNote = (id, body) => api.post(`/admin/support/tickets/${id}/notes`, { body })
export const escalateSupportTicket = (id) => api.post(`/admin/support/tickets/${id}/escalate`)
export function replySupportTicket(id, body, files = []) {
  const form = new FormData()
  form.append('body', body)
  files.forEach((f) => form.append('attachments', f))
  return api.post(`/admin/support/tickets/${id}/messages`, form)
}
export const adminSupportAttachmentUrl = (ticketId, attachmentId) =>
  `${import.meta.env.VITE_API_URL ?? ''}/api/admin/support/tickets/${ticketId}/attachments/${attachmentId}`
