import api from '@/lib/api'

export const getReferralSummary = () => api.get('/referrals/summary')
export const getReferralNetwork = () => api.get('/referrals/network')
export const listCommissions = (params) => api.get('/referrals/commissions', { params })
export const getWallet = () => api.get('/referrals/wallet')
// `auth` is { code } (two-factor users) or { password } (everyone else)
export const saveWallet = (address, auth) => api.put('/referrals/wallet', { address, ...auth })
export const createWithdrawal = (amount, auth) => api.post('/referrals/withdrawals', { amount, ...auth })
export const listWithdrawals = (params) => api.get('/referrals/withdrawals', { params })
export const getCommissionChart = (range) => api.get('/referrals/commissions/chart', { params: { range } })

export async function exportCommissions(params) {
  const blob = await api.get('/referrals/commissions/export', { params, responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `commissions-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}
