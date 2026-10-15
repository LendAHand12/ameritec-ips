import api from '@/lib/api'

export const getReferralSummary = () => api.get('/referrals/summary')
export const getReferralNetwork = () => api.get('/referrals/network')
export const listCommissions = (params) => api.get('/referrals/commissions', { params })
export const getCommissionChart = (range) => api.get('/referrals/commissions/chart', { params: { range } })

export async function exportCommissions(params) {
  const blob = await api.get('/referrals/commissions/export', { params, responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `commissions-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}
