import { Router } from 'express'
import * as admin from '../controllers/admin.controller.js'
import * as adminAuth from '../controllers/adminAuth.controller.js'
import * as adminReferrals from '../controllers/adminReferrals.controller.js'
import * as adminOverview from '../controllers/adminOverview.controller.js'
import * as adminAdmins from '../controllers/adminAdmins.controller.js'
import * as adminTrade from '../controllers/adminTrade.controller.js'
import * as adminSupport from '../controllers/adminSupport.controller.js'
import * as auditLog from '../controllers/auditLog.controller.js'
import { auditAction as act, auditTrail } from '../services/audit.service.js'
import { auditStatsQuerySchema, exportAuditLogsQuerySchema, listAuditLogsQuerySchema } from '../validators/auditLog.validator.js'
import { protectAdmin, requirePermission, requireSuperAdmin } from '../middlewares/auth.js'
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
import { createAdminSchema, resetAdminPasswordSchema, updateAdminSchema } from '../validators/adminAccounts.validator.js'
import { listAdminOrdersQuerySchema, rejectOrderSchema, updateSettingsSchema } from '../validators/adminTrade.validator.js'
import {
  adminLoginSchema,
  exportUsersQuerySchema,
  listUsersQuerySchema,
  changeReferrerSchema,
  rejectFaceSchema,
  listWithdrawalsQuerySchema,
  markWithdrawalPaidSchema,
  rejectWithdrawalSchema,
  listReferralCommissionsQuerySchema,
  listReferrersQuerySchema,
  referralSummaryQuerySchema,
  deleteUserSchema,
  lockUserSchema,
  overviewQuerySchema,
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

// Admin accounts & permissions (super admin only)
router.get('/admins/meta', requireSuperAdmin, adminAdmins.getMeta)
router.get('/admins', requireSuperAdmin, adminAdmins.listAdmins)
router.post('/admins', requireSuperAdmin, act('admin.create'), validate(createAdminSchema), adminAdmins.createAdmin)
router.patch('/admins/:id', requireSuperAdmin, act('admin.update'), validate(updateAdminSchema), adminAdmins.updateAdmin)
router.patch('/admins/:id/password', requireSuperAdmin, act('admin.password_reset'), validate(resetAdminPasswordSchema), adminAdmins.resetAdminPassword)

router.get('/overview', requirePermission('overview:view'), validate(overviewQuerySchema, 'query'), adminOverview.getOverview)

// Referral & commission (read-only)
router.get('/referrals/summary', requirePermission('referrals:view'), validate(referralSummaryQuerySchema, 'query'), adminReferrals.getSummary)
router.get('/referrals/commissions', requirePermission('referrals:view'), validate(listReferralCommissionsQuerySchema, 'query'), adminReferrals.listCommissions)
router.get('/referrals/withdrawals', requirePermission('referrals:view'), validate(listWithdrawalsQuerySchema, 'query'), adminReferrals.listWithdrawals)
router.patch('/referrals/withdrawals/:id/paid', requirePermission('referrals:manage'), act('withdrawal.paid'), validate(markWithdrawalPaidSchema), adminReferrals.markWithdrawalPaid)
router.patch('/referrals/withdrawals/:id/reject', requirePermission('referrals:manage'), act('withdrawal.reject'), validate(rejectWithdrawalSchema), adminReferrals.rejectWithdrawal)
router.get('/referrals/referrers', requirePermission('referrals:view'), validate(listReferrersQuerySchema, 'query'), adminReferrals.listReferrers)

router.get('/users', requirePermission('users:view'), validate(listUsersQuerySchema, 'query'), admin.listUsers)
router.get('/users/stats', requirePermission('users:view'), admin.getUserStats)
router.get('/users/export', requirePermission('users:view'), validate(exportUsersQuerySchema, 'query'), admin.exportUsers)
router.get('/users/:id', requirePermission('users:view'), admin.getUser)
router.get('/users/:id/network', requirePermission('users:view'), admin.getUserNetwork)
router.get('/users/:id/identity/:side', requirePermission('users:view'), admin.getIdentityImage)
router.patch('/users/:id/approve', requirePermission('users:manage'), act('user.approve'), admin.approveUser)
router.patch('/users/:id/reject', requirePermission('users:manage'), act('user.reject'), validate(rejectUserSchema), admin.rejectUser)
router.patch('/users/:id/lock', requirePermission('users:manage'), act('user.lock'), validate(lockUserSchema), admin.lockUser)
router.patch('/users/:id/unlock', requirePermission('users:manage'), act('user.unlock'), admin.unlockUser)
router.patch('/users/:id/face/approve', requirePermission('users:manage'), act('user.face_approve'), admin.approveFace)
router.patch('/users/:id/face/reject', requirePermission('users:manage'), act('user.face_reject'), validate(rejectFaceSchema), admin.rejectFace)
router.patch('/users/:id/verify-email', requirePermission('users:manage'), act('user.verify_email'), admin.verifyUserEmail)
router.patch('/users/:id/referrer', requirePermission('users:manage'), act('user.change_referrer'), validate(changeReferrerSchema), admin.changeReferrer)
router.delete('/users/:id', requirePermission('users:manage'), act('user.delete'), validate(deleteUserSchema), admin.deleteUser)

export default router

// Orders (share purchases)
router.get('/orders', requirePermission('orders:view'), validate(listAdminOrdersQuerySchema, 'query'), adminTrade.listOrders)
router.get('/orders/stats', requirePermission('orders:view'), adminTrade.getOrderStats)
router.get('/orders/:id', requirePermission('orders:view'), adminTrade.getOrder)
router.patch('/orders/:id/approve', requirePermission('orders:manage'), act('order.approve'), adminTrade.approveOrder)
router.patch('/orders/:id/reject', requirePermission('orders:manage'), act('order.reject'), validate(rejectOrderSchema), adminTrade.rejectOrder)
router.post('/orders/:id/certificate', requirePermission('orders:manage'), act('order.certificate_upload'), certificateUpload.single('certificate'), adminTrade.uploadCertificate)
router.get('/orders/:id/certificate', requirePermission('orders:view'), adminTrade.getCertificate)

// Operational parameters (share prices, commission, payment methods)
router.get('/settings', requirePermission('parameters:view'), adminTrade.getSettingsHandler)
router.put('/settings', requirePermission('parameters:manage'), act('settings.update'), validate(updateSettingsSchema), adminTrade.updateSettings)
router.post('/settings/zelle-qr', requirePermission('parameters:manage'), act('settings.zelle_qr'), settingsUpload.single('qr'), adminTrade.uploadZelleQr)
router.get('/settings/zelle-qr', requirePermission('parameters:view'), adminTrade.getZelleQrAdmin)

// Support tickets
router.get('/support/tickets', requirePermission('support:view'), validate(adminListTicketsQuerySchema, 'query'), adminSupport.listTickets)
router.get('/support/tickets/stats', requirePermission('support:view'), adminSupport.getTicketStats)
router.get('/support/agents', requirePermission('support:view'), adminSupport.listAgents)
router.get('/support/tickets/:id', requirePermission('support:view'), adminSupport.getTicket)
router.post('/support/tickets/:id/messages', requirePermission('support:manage'), act('ticket.reply'), supportUpload.array('attachments', MAX_TICKET_ATTACHMENTS), validate(adminReplySchema), adminSupport.replyToTicket)
router.patch('/support/tickets/:id', requirePermission('support:manage'), act('ticket.update'), validate(updateTicketSchema), adminSupport.updateTicket)
router.post('/support/tickets/:id/notes', requirePermission('support:manage'), act('ticket.note'), validate(noteSchema), adminSupport.addNote)
router.post('/support/tickets/:id/escalate', requirePermission('support:manage'), act('ticket.escalate'), adminSupport.escalateTicket)
router.get('/support/tickets/:id/attachments/:attachmentId', requirePermission('support:view'), adminSupport.getAttachment)

// Error catalog (help articles shown to investors)
router.get('/support/articles', requirePermission('support:view'), validate(listArticlesQuerySchema, 'query'), adminSupport.listArticles)
router.post('/support/articles', requirePermission('support:manage'), act('article.create'), validate(articleSchema), adminSupport.createArticle)
router.put('/support/articles/:id', requirePermission('support:manage'), act('article.update'), validate(articleSchema), adminSupport.updateArticle)
router.delete('/support/articles/:id', requirePermission('support:manage'), act('article.delete'), adminSupport.deleteArticle)

// Audit logs (read-only — entries can never be edited or deleted)
router.get('/audit-logs', requirePermission('audit:view'), validate(listAuditLogsQuerySchema, 'query'), auditLog.listAuditLogs)
router.get('/audit-logs/stats', requirePermission('audit:view'), validate(auditStatsQuerySchema, 'query'), auditLog.getAuditStats)
router.get('/audit-logs/meta', requirePermission('audit:view'), auditLog.getAuditMeta)
router.get('/audit-logs/export', requirePermission('audit:view'), validate(exportAuditLogsQuerySchema, 'query'), auditLog.exportAuditLogs)
router.get('/audit-logs/:id', requirePermission('audit:view'), auditLog.getAuditLog)
