import { z } from 'zod'
import { emailSchema } from './auth.validator.js'
import { normalizeReferralCode } from '../utils/normalize.js'
import { ACCOUNT_STATUS, USER_STATUS } from '../models/User.js'

const withinDays = z.coerce.number().int().min(1).max(3650).optional()

export const userFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  kycStatus: z.enum(Object.values(USER_STATUS)).optional(),
  accountStatus: z.enum(Object.values(ACCOUNT_STATUS)).optional(),
  // Accounts whose email was never confirmed (the code mail may not have arrived)
  emailStatus: z.enum(['verified', 'unverified']).optional(),
  faceStatus: z.enum(['none', 'pending', 'approved', 'rejected']).optional(),
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

export const overviewQuerySchema = z
  .object({
    range: z.enum(['today', '7', '30', 'custom']).default('30'),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((q) => q.range !== 'custom' || (q.from && q.to && q.from <= q.to), { message: 'Choose a valid date range' })
  .refine((q) => q.range !== 'custom' || (new Date(q.to) - new Date(q.from)) / 86_400_000 < 366, { message: 'Range can be at most 366 days' })

const commissionStatus = z.enum(['pending', 'available'])

export const referralSummaryQuerySchema = z.object({ range: z.enum(['7', '30', '90']).default('30') })

export const listReferralCommissionsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: commissionStatus.optional(),
  range: z.enum(['7', '30', '90']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const listReferrersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const listWithdrawalsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['pending', 'paid', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const markWithdrawalPaidSchema = z.object({
  txHash: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Enter a valid transaction hash (0x… 66 characters)').optional()),
})

export const rejectWithdrawalSchema = z.object({ reason: z.string().trim().min(1, 'Enter a reason').max(500) })

export const adjustBalanceSchema = z.object({
  direction: z.enum(['add', 'deduct'], { error: 'Choose add or deduct' }),
  amount: z.coerce.number({ error: 'Enter an amount' }).positive('Enter an amount').max(10_000_000, 'Amount is too large'),
  // Always required and shown to the user next to the adjustment
  reason: z.string({ error: 'Enter a reason' }).trim().min(3, 'Enter a reason (at least 3 characters)').max(500),
})

export const changeReferrerSchema = z.object({
  // Empty = remove the referrer
  referralCode: z
    .string()
    .optional()
    .transform((v) => normalizeReferralCode(v) || undefined),
})

export const deleteUserSchema = z.object({ reason: z.string().trim().max(500).optional() })

export const rejectFaceSchema = z.object({ reason: z.string().trim().min(1, 'Enter a reason').max(500) })

export const lockUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const rejectUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const adminLoginTwoFactorSchema = z.object({ loginToken: z.string().min(1), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') })
export const adminSetupTwoFactorSchema = z.object({ password: z.string().min(1, 'Enter your password') })
export const adminEnableTwoFactorSchema = z.object({ setupToken: z.string().min(1), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') })
export const adminDisableTwoFactorSchema = z.object({ password: z.string().min(1, 'Enter your password'), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') })

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})
