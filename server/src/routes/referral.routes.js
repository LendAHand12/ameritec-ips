import { Router } from 'express'
import * as referral from '../controllers/referral.controller.js'
import { protect } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { authLimiter, otpLimiter } from '../middlewares/rateLimit.js'
import { commissionChartQuerySchema, commissionsQuerySchema, setWalletSchema, withdrawSchema, withdrawalsQuerySchema } from '../validators/referral.validator.js'

const router = Router()

router.use(protect)

router.get('/summary', referral.getSummary)
router.get('/network', referral.getNetwork)
router.get('/commissions', validate(commissionsQuerySchema, 'query'), referral.listCommissions)
router.get('/commissions/export', validate(commissionsQuerySchema, 'query'), referral.exportCommissions)
router.get('/wallet', referral.getWallet)
router.put('/wallet', otpLimiter, validate(setWalletSchema), referral.setWallet)
router.get('/withdrawals', validate(withdrawalsQuerySchema, 'query'), referral.listWithdrawals)
router.post('/withdrawals', otpLimiter, authLimiter, validate(withdrawSchema), referral.createWithdrawal)
router.get('/commissions/chart', validate(commissionChartQuerySchema, 'query'), referral.getCommissionChart)

export default router
