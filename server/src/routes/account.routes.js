import { Router } from 'express'
import { z } from 'zod'
import * as account from '../controllers/account.controller.js'
import { protect } from '../middlewares/auth.js'
import { kycUpload } from '../middlewares/upload.js'
import { authLimiter, otpLimiter } from '../middlewares/rateLimit.js'
import { validate } from '../middlewares/validate.js'
import { passwordSchema } from '../validators/auth.validator.js'

const code = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code')
// Two-factor users give a code; everyone else confirms with their password (checked in the service)
const optionalCode = code.optional()
const optionalPassword = z.string().max(200).optional()

const updatePhoneSchema = z.object({
  phoneCountry: z.string().trim().toUpperCase().min(2, 'Select a country code').max(2),
  phoneNumber: z.string().trim().min(1, 'Phone number is required'),
  code: optionalCode,
  password: optionalPassword,
})

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string({ error: 'Please confirm your password' }),
    code: optionalCode,
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

const setupTwoFactorSchema = z.object({ password: z.string().min(1, 'Enter your password') })
const enableTwoFactorSchema = z.object({ setupToken: z.string().min(1), code })
const disableTwoFactorSchema = z.object({ password: z.string().min(1, 'Enter your password'), code })

const router = Router()

router.use(protect)

router.get('/', account.getAccount)
router.patch('/phone', otpLimiter, validate(updatePhoneSchema), account.updatePhone)
router.post('/password', otpLimiter, validate(changePasswordSchema), account.changePassword)
router.post('/face', authLimiter, kycUpload.single('face'), account.submitFace)
router.post('/2fa/setup', otpLimiter, validate(setupTwoFactorSchema), account.setupTwoFactor)
router.post('/2fa/enable', otpLimiter, validate(enableTwoFactorSchema), account.enableTwoFactor)
router.post('/2fa/disable', otpLimiter, validate(disableTwoFactorSchema), account.disableTwoFactor)
router.get('/session', account.getSession)
router.post('/sessions/revoke-others', authLimiter, account.signOutOtherSessions)

export default router
