import { z } from 'zod'
import { SHARE_TYPES } from '../models/Order.js'

export const createOrderSchema = z.object({
  shareType: z.enum(SHARE_TYPES, { error: 'Choose a class' }),
  amount: z.coerce.number({ error: 'Enter an amount' }).positive('Enter an amount').max(10_000_000, 'Amount is too large'),
})

export const submitPaymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('bep20'),
    txHash: z
      .string()
      .trim()
      .regex(/^0x[0-9a-fA-F]{64}$/, 'Enter a valid transaction hash (0x… 66 characters)')
      .transform((v) => v.toLowerCase()),
  }),
  z.object({
    method: z.literal('zelle'),
    reference: z.string().trim().max(100).optional(),
  }),
])

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
