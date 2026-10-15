import { Router } from 'express'
import * as admin from '../controllers/admin.controller.js'
import * as adminAuth from '../controllers/adminAuth.controller.js'
import * as adminTrade from '../controllers/adminTrade.controller.js'
import * as adminSupport from '../controllers/adminSupport.controller.js'
import * as auditLog from '../controllers/auditLog.controller.js'
import { auditAction as act, auditTrail } from '../services/audit.service.js'
import { auditStatsQuerySchema, exportAuditLogsQuerySchema, listAuditLogsQuerySchema } from '../validators/auditLog.validator.js'
import { protectAdmin } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { authLimiter } from '../middlewares/rateLimit.js'
import { certificateUpload, settingsUpload, supportUpload } from '../middlewares/upload.js'
import { MAX_TICKET_ATTACHMENTS } from '../models/SupportTicket.js'
import {
  adminListTicketsQuerySchema,
  adminReplySchema,
  noteSchema,
  articleSchema,
  listArticlesQuerySchema,
  updateTicketSchema,
} from '../validators/support.validator.js'
import { listAdminOrdersQuerySchema, rejectOrderSchema, updateSettingsSchema } from '../validators/adminTrade.validator.js'
import {
  adminLoginSchema,
  exportUsersQuerySchema,
  listUsersQuerySchema,
  lockUserSchema,
  rejectUserSchema,
} from '../validators/admin.validator.js'

const router = Router()

// Every admin request that changes something leaves an audit entry
router.use(auditTrail)

// Admin authentication (separate from customer auth)
router.post('/auth/login', act('admin.login'), authLimiter, validate(adminLoginSchema), adminAuth.login)
router.post('/auth/logout', act('admin.logout'), adminAuth.logout)
router.get('/auth/me', protectAdmin, adminAuth.me)

// Everything below requires an admin session
router.use(protectAdmin)

router.get('/users', validate(listUsersQuerySchema, 'query'), admin.listUsers)
router.get('/users/stats', admin.getUserStats)
router.get('/users/export', validate(exportUsersQuerySchema, 'query'), admin.exportUsers)
router.get('/users/:id', admin.getUser)
router.get('/users/:id/identity/:side', admin.getIdentityImage)
router.patch('/users/:id/approve', act('user.approve'), admin.approveUser)
router.patch('/users/:id/reject', act('user.reject'), validate(rejectUserSchema), admin.rejectUser)
router.patch('/users/:id/lock', act('user.lock'), validate(lockUserSchema), admin.lockUser)
router.patch('/users/:id/unlock', act('user.unlock'), admin.unlockUser)

export default router

// Orders (share purchases)
router.get('/orders', validate(listAdminOrdersQuerySchema, 'query'), adminTrade.listOrders)
router.get('/orders/stats', adminTrade.getOrderStats)
router.get('/orders/:id', adminTrade.getOrder)
router.patch('/orders/:id/approve', act('order.approve'), adminTrade.approveOrder)
router.patch('/orders/:id/reject', act('order.reject'), validate(rejectOrderSchema), adminTrade.rejectOrder)
router.post('/orders/:id/certificate', act('order.certificate_upload'), certificateUpload.single('certificate'), adminTrade.uploadCertificate)
router.get('/orders/:id/certificate', adminTrade.getCertificate)

// Operational parameters (share prices, commission, payment methods)
router.get('/settings', adminTrade.getSettingsHandler)
router.put('/settings', act('settings.update'), validate(updateSettingsSchema), adminTrade.updateSettings)
router.post('/settings/zelle-qr', act('settings.zelle_qr'), settingsUpload.single('qr'), adminTrade.uploadZelleQr)
router.get('/settings/zelle-qr', adminTrade.getZelleQrAdmin)

// Support tickets
router.get('/support/tickets', validate(adminListTicketsQuerySchema, 'query'), adminSupport.listTickets)
router.get('/support/tickets/stats', adminSupport.getTicketStats)
router.get('/support/agents', adminSupport.listAgents)
router.get('/support/tickets/:id', adminSupport.getTicket)
router.post('/support/tickets/:id/messages', act('ticket.reply'), supportUpload.array('attachments', MAX_TICKET_ATTACHMENTS), validate(adminReplySchema), adminSupport.replyToTicket)
router.patch('/support/tickets/:id', act('ticket.update'), validate(updateTicketSchema), adminSupport.updateTicket)
router.post('/support/tickets/:id/notes', act('ticket.note'), validate(noteSchema), adminSupport.addNote)
router.post('/support/tickets/:id/escalate', act('ticket.escalate'), adminSupport.escalateTicket)
router.get('/support/tickets/:id/attachments/:attachmentId', adminSupport.getAttachment)

// Error catalog (help articles shown to investors)
router.get('/support/articles', validate(listArticlesQuerySchema, 'query'), adminSupport.listArticles)
router.post('/support/articles', act('article.create'), validate(articleSchema), adminSupport.createArticle)
router.put('/support/articles/:id', act('article.update'), validate(articleSchema), adminSupport.updateArticle)
router.delete('/support/articles/:id', act('article.delete'), adminSupport.deleteArticle)

// Audit logs (read-only — entries can never be edited or deleted)
router.get('/audit-logs', validate(listAuditLogsQuerySchema, 'query'), auditLog.listAuditLogs)
router.get('/audit-logs/stats', validate(auditStatsQuerySchema, 'query'), auditLog.getAuditStats)
router.get('/audit-logs/meta', auditLog.getAuditMeta)
router.get('/audit-logs/export', validate(exportAuditLogsQuerySchema, 'query'), auditLog.exportAuditLogs)
router.get('/audit-logs/:id', auditLog.getAuditLog)
