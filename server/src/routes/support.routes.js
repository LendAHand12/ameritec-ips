import { Router } from 'express'
import * as support from '../controllers/support.controller.js'
import { protect } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { authLimiter } from '../middlewares/rateLimit.js'
import { supportUpload } from '../middlewares/upload.js'
import { MAX_TICKET_ATTACHMENTS } from '../models/SupportTicket.js'
import { createTicketSchema, listTicketsQuerySchema, replySchema } from '../validators/support.validator.js'

const router = Router()
const attachments = supportUpload.array('attachments', MAX_TICKET_ATTACHMENTS)

router.use(protect)

router.get('/articles', support.listArticles)
router.get('/tickets', validate(listTicketsQuerySchema, 'query'), support.listMyTickets)
router.get('/tickets/stats', support.getMyTicketStats)
router.post('/tickets', authLimiter, attachments, validate(createTicketSchema), support.createTicket)
router.get('/tickets/:id', support.getMyTicket)
router.post('/tickets/:id/messages', authLimiter, attachments, validate(replySchema), support.replyToTicket)
router.get('/tickets/:id/attachments/:attachmentId', support.getMyAttachment)

export default router
