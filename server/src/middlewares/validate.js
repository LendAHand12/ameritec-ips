import { z } from 'zod'
import ApiError from '../utils/ApiError.js'

/** Validates and replaces req.body (or stores parsed query in req.validatedQuery). */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {})
  if (!result.success) {
    const { fieldErrors, formErrors } = z.flattenError(result.error)
    const details = Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v[0]]))
    throw new ApiError(400, formErrors[0] ?? Object.values(details)[0] ?? 'Invalid data', details, 'VALIDATION_ERROR')
  }
  if (source === 'query') req.validatedQuery = result.data
  else req[source] = result.data
  next()
}
