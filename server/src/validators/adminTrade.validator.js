import { z } from 'zod'
import { ORDER_STATUS, PAYMENT_METHODS, SHARE_TYPES } from '../models/Order.js'

export const listAdminOrdersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(Object.values(ORDER_STATUS)).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  shareType: z.enum(SHARE_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const rejectOrderSchema = z.object({
  reason: z.string().trim().min(1, 'Enter a reason').max(500),
})

const minAmount = z.coerce.number().min(0, 'Enter 0 or more').max(10_000_000)
const price = z.coerce.number().positive('Price must be greater than 0').max(1_000_000)
const shareConfig = z.object({
  label: z.string().trim().min(1).max(50),
  description: z.string().trim().max(100),
  price,
  allocation: z.coerce.number().int('Enter a whole number').min(0, 'Enter 0 or more').max(1_000_000_000_000),
  commissionPct: z.coerce.number().min(0, 'Commission must be 0–100%').max(100, 'Commission must be 0–100%'),
})

export const updateSettingsSchema = z.object({
  shares: z.object({ A: shareConfig, B: shareConfig }),
  minPurchase: z.object({ first: minAmount, next: minAmount }),
  payment: z.object({
    bep20: z.object({
      enabled: z.boolean(),
      address: z
        .string()
        .trim()
        .refine((v) => v === '' || /^0x[0-9a-fA-F]{40}$/.test(v), 'Enter a valid BEP20 wallet address (0x… 42 characters)'),
    }),
    // Zelle only needs the QR code (uploaded separately)
    zelle: z.object({ enabled: z.boolean() }),
  }),
})
