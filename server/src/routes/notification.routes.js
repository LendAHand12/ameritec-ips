import { Router } from 'express'
import { z } from 'zod'
import * as notifications from '../controllers/notification.controller.js'
import { protect } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'

const markReadSchema = z.object({
  ids: z.array(z.string().regex(/^[0-9a-f]{24}$/i)).max(100).default([]),
  all: z.boolean().default(false),
})

const router = Router()
router.use(protect)
router.get('/', notifications.listMyNotifications)
router.post('/read', validate(markReadSchema), notifications.markNotificationsRead)

export default router
