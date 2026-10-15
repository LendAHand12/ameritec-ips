import { z } from 'zod'
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, AUDIT_RECORD_TYPES } from '../models/AuditLog.js'

const filters = {
  q: z.string().trim().max(100).optional(),
  category: z.enum(Object.keys(AUDIT_CATEGORIES)).optional(),
  action: z.enum(Object.keys(AUDIT_ACTIONS)).optional(),
  admin: z.string().regex(/^[0-9a-f]{24}$/i).optional(),
  recordType: z.enum(Object.keys(AUDIT_RECORD_TYPES)).optional(),
  result: z.enum(['success', 'failure']).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
}

export const listAuditLogsQuerySchema = z.object({
  ...filters,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const exportAuditLogsQuerySchema = z.object(filters)
export const auditStatsQuerySchema = z.object({ days: filters.days })
