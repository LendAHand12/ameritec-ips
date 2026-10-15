import { Router } from 'express'
import * as referral from '../controllers/referral.controller.js'
import { protect } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { commissionChartQuerySchema, commissionsQuerySchema } from '../validators/referral.validator.js'

const router = Router()

router.use(protect)

router.get('/summary', referral.getSummary)
router.get('/network', referral.getNetwork)
router.get('/commissions', validate(commissionsQuerySchema, 'query'), referral.listCommissions)
router.get('/commissions/export', validate(commissionsQuerySchema, 'query'), referral.exportCommissions)
router.get('/commissions/chart', validate(commissionChartQuerySchema, 'query'), referral.getCommissionChart)

export default router
