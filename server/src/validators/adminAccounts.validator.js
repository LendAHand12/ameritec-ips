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

export const sendNotificationSchema = z
  .object({
    audience: z.enum(['all', 'user'], { error: 'Choose who receives it' }),
    userId: z.string().regex(/^[0-9a-f]{24}$/i, 'Choose a user').optional(),
    title: z.string().trim().min(3, 'Enter a title (3+ characters)').max(100),
    message: z.string().trim().min(1, 'Enter the message').max(2000),
  })
  .refine((d) => d.audience === 'all' || d.userId, { path: ['userId'], message: 'Choose a user' })

export const ipWhitelistSchema = z.object({
  enabled: z.boolean(),
  entries: z
    .array(z.object({ ip: z.string().trim().min(1, 'Enter an IP address').max(64), note: z.string().trim().max(100).optional() }))
    .max(100, 'At most 100 entries'),
})

export const resetAdminPasswordSchema = z.object({ password: passwordSchema })
