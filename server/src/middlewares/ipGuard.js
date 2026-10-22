import { getSettings } from '../models/Setting.js'
import ApiError from '../utils/ApiError.js'
import { isAllowed } from '../services/ipWhitelist.service.js'

/**
 * Admin portal only: when the IP whitelist is switched on, requests from any other address are refused
 * (sign-in included), so a stolen password or session is useless from elsewhere.
 */
export async function ipGuard(req, res, next) {
  const { adminIpWhitelist } = await getSettings()
  if (adminIpWhitelist?.enabled && adminIpWhitelist.entries.length && !isAllowed(req.ip, adminIpWhitelist.entries)) {
    throw new ApiError(403, 'Access from your IP address is not allowed', undefined, 'IP_NOT_ALLOWED')
  }
  next()
}
