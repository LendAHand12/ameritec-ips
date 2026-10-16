import { z } from 'zod'
import { PERMISSIONS } from '../config/permissions.js'
import { emailSchema, passwordSchema } from './auth.validator.js'

const permissions = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length)

export const createAdminSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter a name').max(100),
  email: emailSchema,
  password: passwordSchema,
  permissions,
})

export const updateAdminSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter a name').max(100),
  permissions,
  isActive: z.boolean(),
})

export const resetAdminPasswordSchema = z.object({ password: passwordSchema })
