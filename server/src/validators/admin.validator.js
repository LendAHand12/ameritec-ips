import { z } from 'zod'
import { emailSchema } from './auth.validator.js'
import { ACCOUNT_STATUS, USER_STATUS } from '../models/User.js'

const withinDays = z.coerce.number().int().min(1).max(3650).optional()

export const userFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  kycStatus: z.enum(Object.values(USER_STATUS)).optional(),
  accountStatus: z.enum(Object.values(ACCOUNT_STATUS)).optional(),
  registeredWithin: withinDays,
  submittedWithin: withinDays,
})

export const listUsersQuerySchema = userFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const exportUsersQuerySchema = userFiltersSchema.extend({
  ids: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : undefined))
    .pipe(z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(1000).optional()),
})

export const lockUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const rejectUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})
