import multer from 'multer'
import env from '../config/env.js'
import ApiError from '../utils/ApiError.js'
import { cleanupUploadedFiles } from './upload.js'

export function notFound(req, res) {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  cleanupUploadedFiles(req)

  let status = err.statusCode ?? 500
  let message = err.message ?? 'Internal Server Error'
  let details = err.details
  let code = err.code

  if (err instanceof multer.MulterError) {
    status = 400
    code = 'UPLOAD_ERROR'
    if (err.code === 'LIMIT_FILE_SIZE') message = 'File is too large'
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') message = 'Too many files'
    if (err.field) details = { [err.field]: message }
  }
  if (err.name === 'ValidationError') {
    status = 400
    message = Object.values(err.errors).map((e) => e.message).join(', ')
  }
  if (err.name === 'CastError') {
    status = 400
    message = `Invalid ${err.path}`
  }
  if (err.code === 11000) {
    status = 409
    const field = Object.keys(err.keyValue ?? {})[0]
    message = `${field} is already in use`
    details = { [field]: message }
    code = 'DUPLICATE'
  }

  // Expected failures (ApiError) are already described by their message; only dump real crashes
  const unexpected = status >= 500 && !(err instanceof ApiError)
  if (unexpected) console.error(err)

  res.locals.errorMessage = message // picked up by the audit trail
  res.status(status).json({
    message: unexpected && env.isProd ? 'Internal Server Error' : message,
    ...(typeof code === 'string' && { code }),
    ...(details && { details }),
    ...(!env.isProd && unexpected && { stack: err.stack }),
  })
}
