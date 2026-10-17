import api from '@/lib/api'

/** Asks the server for the FaceTec page to send the browser to. Resolves to { url }. */
export const startFaceScan = () => api.post('/kyc/start-face-scan')

/** Forwards what FaceTec returned (from the callback URL) so the server can verify and save it. */
export const completeFaceScan = ({ token, facetecTid, status, ageEstimate }) =>
  api.post('/kyc/complete-face-scan', { token, facetecTid, status, ageEstimate })
