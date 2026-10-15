import fs from 'fs'
import crypto from 'crypto'
import multer from 'multer'
import env from '../config/env.js'
import ApiError from '../utils/ApiError.js'

export const IMAGE_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export const DOCUMENT_MIME = {
  ...IMAGE_MIME,
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}

export function createUpload({ dir, maxSizeMB, allowedMime }) {
  fs.mkdirSync(dir, { recursive: true })

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      // Extension comes from the validated mimetype, never from the client's filename
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${allowedMime[file.mimetype]}`),
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (allowedMime[file.mimetype]) return cb(null, true)
      const allowed = Object.values(allowedMime).map((ext) => ext.slice(1).toUpperCase()).join(', ')
      cb(new ApiError(400, 'File type not allowed', { [file.fieldname]: `Allowed file types: ${allowed}` }))
    },
  })
}

/** Public files, served at /uploads */
export const publicUpload = createUpload({ dir: env.upload.dir, maxSizeMB: env.upload.maxSizeMB, allowedMime: DOCUMENT_MIME })

/** Identity documents — private, never served statically */
export const kycUpload = createUpload({ dir: env.kyc.dir, maxSizeMB: env.kyc.maxSizeMB, allowedMime: IMAGE_MIME })

/** Share certificates uploaded by admins — private */
export const certificateUpload = createUpload({
  dir: env.certificates.dir,
  maxSizeMB: 10,
  allowedMime: { 'application/pdf': '.pdf', ...IMAGE_MIME },
})

/** Payment settings files (Zelle QR) — private, served to eligible users only */
export const settingsUpload = createUpload({ dir: env.settingsDir, maxSizeMB: 2, allowedMime: IMAGE_MIME })

/** Screenshots attached to support tickets — private, served to the ticket owner and admins only */
export const supportUpload = createUpload({ dir: env.supportDir, maxSizeMB: 10, allowedMime: IMAGE_MIME })

/** Removes every file multer saved for this request (used when the request fails). */
export function cleanupUploadedFiles(req) {
  const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat())]
  for (const file of files) {
    if (file?.path) fs.promises.unlink(file.path).catch(() => {})
  }
}
