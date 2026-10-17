import path from 'path'
import env from '../config/env.js'
import ApiError from '../utils/ApiError.js'

/** The account has a face photo to show: a FaceTec scan, or an upload from before the FaceTec flow. */
export const hasFaceImage = (user) => !!(user?.face?.image || user?.faceTecTid)

// Scans made through FaceTec keep their photo on the FaceTec host; relay it so it never leaves our API
async function sendFaceTecImage(res, tid) {
  if (!env.facetec.apiHost) throw new ApiError(404, 'Image not found')
  let upstream
  try {
    upstream = await fetch(`${env.facetec.apiHost}/api/liveness/image?tid=${encodeURIComponent(tid)}`, { signal: AbortSignal.timeout(10_000) })
  } catch {
    throw new ApiError(502, 'Could not load the face scan image')
  }
  // The host labels its JPEGs "img/jpg"; errors come back as JSON
  const type = (upstream.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!upstream.ok || !/^im(g|age)\//.test(type)) throw new ApiError(404, 'Image not found')

  res.set('Cache-Control', 'private, no-store')
  res.type(/jpe?g$/.test(type) ? 'image/jpeg' : type.replace(/^img\//, 'image/'))
  res.send(Buffer.from(await upstream.arrayBuffer()))
}

/** Sends the user's face photo (older local upload first, else the FaceTec scan). */
export async function sendFaceImage(res, user) {
  if (user.face?.image) {
    res.set('Cache-Control', 'private, no-store')
    return res.sendFile(path.basename(user.face.image), { root: path.resolve(env.kyc.dir) })
  }
  if (user.faceTecTid) return sendFaceTecImage(res, user.faceTecTid)
  throw new ApiError(404, 'Image not found')
}
