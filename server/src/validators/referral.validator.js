import { z } from 'zod'

export const commissionsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const commissionChartQuerySchema = z.object({
  range: z.enum(['7D', '30D', '3M', '1Y', 'ALL']).default('30D'),
})
