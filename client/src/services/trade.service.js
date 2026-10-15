import api from '@/lib/api'

export const getTradeConfig = () => api.get('/trade/config')
export const getPortfolio = () => api.get('/trade/portfolio')
export const listOrders = (params) => api.get('/trade/orders', { params })
export const createOrder = (data) => api.post('/trade/orders', data)
export const getOrder = (id) => api.get(`/trade/orders/${id}`)
export const submitPayment = (id, data) => api.post(`/trade/orders/${id}/pay`, data)
export const refreshPayment = (id) => api.post(`/trade/orders/${id}/refresh`)
export const cancelOrder = (id) => api.post(`/trade/orders/${id}/cancel`)

const apiBase = () => `${import.meta.env.VITE_API_URL ?? ''}/api`
export const certificateUrl = (id) => `${apiBase()}/trade/orders/${id}/certificate`
export const zelleQrUrl = () => `${apiBase()}/trade/zelle-qr`
