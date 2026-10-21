import { z } from 'zod'
import { SHARE_TYPES } from '../models/Order.js'

export const createOrderSchema = z.object({
  shareType: z.enum(SHARE_TYPES, { error: 'Choose a class' }),
  // Shares are whole numbers; the amount to pay is shares × the class price
  shares: z.coerce.number({ error: 'Enter the number of shares' }).int('Shares must be a whole number').positive('Enter the number of shares').max(100_000_000, 'Too many shares'),
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
    // The transfer only counts if its note contains the transaction code: the customer must confirm they wrote it
    memoConfirmed: z.literal(true, { error: 'Confirm that you entered the transaction code in the transfer note' }),
    reference: z.string().trim().max(100).optional(),
  }),
])

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
