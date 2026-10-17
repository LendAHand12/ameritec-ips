import crypto from 'crypto'
import env from '../config/env.js'
import User, { FACE_STATUS } from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import { TOKEN_PURPOSE, signToken, verifyToken } from '../utils/tokens.js'
import { releasePendingCommissions } from '../services/commission.service.js'
import { notifyFaceSubmitted } from '../services/telegram.service.js'

const LINK_TTL = '1h'

/**
 * Step 1. Signs a one-hour link for this user and returns the FaceTec page to send the browser to.
 * FaceTec scans the face, then redirects back to <client>/user/kyc-callback with the result appended.
 */
export async function startFaceScan(req, res) {
  if (!env.facetec.baseUrl) throw new ApiError(503, 'Face scan is not available right now. Please try again later.', undefined, 'FACE_SCAN_UNAVAILABLE')
  const user = await User.findById(req.user._id)
  if (user.faceVerified || user.face?.status === FACE_STATUS.APPROVED) throw new ApiError(409, 'Your face scan is already verified.')
  if (user.face?.status === FACE_STATUS.PENDING) throw new ApiError(409, 'Your face scan is already waiting for review.')

  // Single use: only the most recently issued link can be completed
  const jti = crypto.randomBytes(16).toString('hex')
  user.faceScanSession = { jti, startedAt: new Date() }
  await user.save()

  const token = signToken(TOKEN_PURPOSE.FACE_SCAN, { userId: user.id, jti }, LINK_TTL)
  const callback = `${env.clientUrl}/user/kyc-callback?token=${token}&user_id=${user.id}`
  res.json({ url: `${env.facetec.baseUrl}/enroll.html?callback=${callback}` })
}

/**
 * Step 2. The callback page reports what FaceTec returned. The token must be ours, unexpired, issued to
 * the signed-in user and not used before. A successful scan is saved, then approved by an admin (or
 * straight away when FACETEC_AUTO_APPROVE is on).
 */
export async function completeFaceScan(req, res) {
  const { token, facetecTid, status, ageEstimate } = req.body
  const payload = verifyToken(token, TOKEN_PURPOSE.FACE_SCAN, {
    code: 'FACE_SCAN_EXPIRED',
    message: 'This face scan link has expired. Please start again.',
  })
  if (payload.userId !== req.user.id) throw new ApiError(403, 'This face scan belongs to another account.', undefined, 'FACE_SCAN_WRONG_USER')

  const user = await User.findById(req.user._id)
  if (!user.faceScanSession?.jti || user.faceScanSession.jti !== payload.jti) {
    throw new ApiError(409, 'This face scan link was already used or replaced. Please start again.', undefined, 'FACE_SCAN_REPLAYED')
  }
  // Whatever happens next, this link is spent
  user.faceScanSession = undefined

  if (status !== 'success' || !facetecTid) {
    await user.save()
    throw new ApiError(400, 'The face scan was not completed. Please try again.', undefined, 'FACE_SCAN_FAILED')
  }
  if (await User.exists({ faceTecTid: facetecTid, _id: { $ne: user._id } })) {
    await user.save()
    throw new ApiError(409, 'This face scan has already been used for another account.', undefined, 'FACE_SCAN_DUPLICATE')
  }

  const autoApprove = env.facetec.autoApprove
  user.faceTecTid = facetecTid
  user.ageEstimate = ageEstimate
  user.face = {
    status: autoApprove ? FACE_STATUS.APPROVED : FACE_STATUS.PENDING,
    submittedAt: new Date(),
    ...(autoApprove && { reviewedAt: new Date() }),
  }
  user.faceVerified = autoApprove
  await user.save()

  if (autoApprove) await releasePendingCommissions(user._id)
  else notifyFaceSubmitted(user)
  res.json({ success: true, status: user.face.status })
}
