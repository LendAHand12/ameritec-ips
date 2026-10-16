import { z } from 'zod'

export const commissionsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  status: z.enum(['pending', 'available']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const commissionChartQuerySchema = z.object({
  range: z.enum(['7D', '30D', '3M', '1Y', 'ALL']).default('30D'),
})

// Authenticator code (2FA users) or password (everyone else): the service checks whichever applies
const code = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code').optional()
const password = z.string().max(200).optional()

export const setWalletSchema = z.object({
  address: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'Enter a valid BNB Smart Chain (BEP20) address — 0x followed by 40 characters'),
  code,
  password,
})

export const withdrawSchema = z.object({
  amount: z.coerce.number({ error: 'Enter an amount' }).positive('Enter an amount').max(10_000_000, 'Amount is too large'),
  code,
  password,
})

export const withdrawalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
