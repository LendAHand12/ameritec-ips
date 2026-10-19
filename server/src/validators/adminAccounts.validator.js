import { z } from 'zod'
import { PERMISSIONS } from '../config/permissions.js'
import { emailSchema, passwordSchema } from './auth.validator.js'

const permissions = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length)

const roleId = z.string().regex(/^[0-9a-f]{24}$/i).nullish()

export const roleSchema = z.object({
  name: z.string().trim().min(2, 'Enter a role name').max(50),
  description: z.string().trim().max(200).default(''),
  permissions,
})

export const createAdminSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter a name').max(100),
  email: emailSchema,
  password: passwordSchema,
  permissions,
  roleId,
})

export const updateAdminSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter a name').max(100),
  permissions,
  roleId,
  isActive: z.boolean(),
})

export const resetAdminPasswordSchema = z.object({ password: passwordSchema })
