import api from '@/lib/api'

export const listNotifications = () => api.get('/notifications')
export const markNotificationsRead = (payload) => api.post('/notifications/read', payload)
