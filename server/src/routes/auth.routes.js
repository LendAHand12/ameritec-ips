import { Router } from 'express'
import * as auth from '../controllers/auth.controller.js'
import { protect } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { kycUpload } from '../middlewares/upload.js'
import { authLimiter, otpLimiter } from '../middlewares/rateLimit.js'
import {
  accountInfoSchema,
  loginSchema,
  loginTwoFactorSchema,
  registerSchema,
  resendVerificationSchema,
  twoFactorSetupSchema,
  twoFactorVerifySetupSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js'

const router = Router()

// Registration
router.post('/register/check', authLimiter, validate(accountInfoSchema), auth.checkAccountInfo)
router.post('/register/2fa/setup', authLimiter, validate(twoFactorSetupSchema), auth.setupTwoFactor)
router.post('/register/2fa/verify', otpLimiter, validate(twoFactorVerifySetupSchema), auth.verifyTwoFactorSetup)
router.post(
  '/register',
  authLimiter,
  kycUpload.fields([
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
    { name: 'supportingDocument', maxCount: 1 },
  ]),
  validate(registerSchema),
  auth.register,
)

// Email verification
router.post('/verify-email', otpLimiter, validate(verifyEmailSchema), auth.verifyEmail)
router.post('/resend-verification', authLimiter, validate(resendVerificationSchema), auth.resendVerification)

// Login / session
router.post('/login', authLimiter, validate(loginSchema), auth.login)
router.post('/login/2fa', otpLimiter, validate(loginTwoFactorSchema), auth.loginTwoFactor)
router.post('/logout', auth.logout)
router.get('/me', protect, auth.me)

export default router
