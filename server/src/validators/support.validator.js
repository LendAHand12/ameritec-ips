import { z } from 'zod'
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUS } from '../models/SupportTicket.js'

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => v || undefined)

export const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES, { error: 'Choose an issue type' }),
  subject: z.string({ error: 'Enter a subject' }).trim().min(1, 'Enter a subject').max(150, 'Subject must be at most 150 characters'),
  description: z
    .string({ error: 'Describe the issue' })
    .trim()
    .min(10, 'Please describe the issue in a bit more detail')
    .max(1000, 'Description must be at most 1,000 characters'),
  errorCode: optionalText(30).transform((v) => v?.toUpperCase()),
  relatedTransaction: optionalText(50).transform((v) => v?.toUpperCase()),
})

export const replySchema = z.object({
  body: z.string({ error: 'Enter a message' }).trim().min(1, 'Enter a message').max(1000, 'Message must be at most 1,000 characters'),
})

export const listTicketsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(Object.values(TICKET_STATUS)).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const noteSchema = z.object({
  body: z.string({ error: 'Enter a note' }).trim().min(1, 'Enter a note').max(1000, 'Note must be at most 1,000 characters'),
})

export const adminReplySchema = replySchema.extend({
  // Status after the reply; usually the investor needs to answer
  status: z.enum(Object.values(TICKET_STATUS)).default(TICKET_STATUS.WAITING_FOR_USER),
})

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id')

export const adminListTicketsQuerySchema = listTicketsQuerySchema.extend({
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignee: objectId.optional(), // a specific agent
  scope: z.enum(['mine', 'unassigned']).optional(),
})

export const updateTicketSchema = z
  .object({
    status: z.enum(Object.values(TICKET_STATUS)).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assignedTo: objectId.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

const ARTICLE_CODE = /^[A-Z]{2,10}-\d{3}$/

export const articleSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(ARTICLE_CODE, 'Use a code like KYC-001')),
  category: z.enum(TICKET_CATEGORIES, { error: 'Choose a category' }),
  title: z.string().trim().min(1, 'Enter a title').max(120),
  summary: z.string().trim().min(1, 'Enter a short summary').max(200),
  keywords: z.string().trim().max(300).default(''),
  steps: z
    .array(z.string().trim().max(500))
    .transform((steps) => steps.filter(Boolean))
    .pipe(z.array(z.string()).min(1, 'Add at least one step').max(15, 'Use at most 15 steps')),
  published: z.boolean().default(true),
})

export const listArticlesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  published: z.enum(['true', 'false']).optional(),
})
