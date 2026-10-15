import api from '@/lib/api'

const toFormData = (fields, files = []) => {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => v !== undefined && v !== '' && fd.append(k, v))
  files.forEach((f) => fd.append('attachments', f))
  return fd
}

export const listArticles = () => api.get('/support/articles')
export const listTickets = (params) => api.get('/support/tickets', { params })
export const getTicketStats = () => api.get('/support/tickets/stats')
export const getTicket = (id) => api.get(`/support/tickets/${id}`)
export const createTicket = (fields, files) => api.post('/support/tickets', toFormData(fields, files))
export const replyToTicket = (id, body, files) => api.post(`/support/tickets/${id}/messages`, toFormData({ body }, files))

const apiBase = () => `${import.meta.env.VITE_API_URL ?? ''}/api`
export const attachmentUrl = (ticketId, attachmentId) => `${apiBase()}/support/tickets/${ticketId}/attachments/${attachmentId}`
