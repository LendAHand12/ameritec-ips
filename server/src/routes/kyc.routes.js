import { Router } from 'express'
import { z } from 'zod'
import * as kyc from '../controllers/kyc.controller.js'
import { protect } from '../middlewares/auth.js'
import { authLimiter } from '../middlewares/rateLimit.js'
import { validate } from '../middlewares/validate.js'

// What the callback page forwards from FaceTec's redirect (age_estimate may be missing or non-numeric)
const completeFaceScanSchema = z.object({
  token: z.string().min(1, 'Missing token'),
  facetecTid: z.string().trim().max(200).optional(),
  status: z.string().trim().max(50).optional(),
  ageEstimate: z.preprocess((v) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v)), z.number().min(0).max(130).optional()),
})

const router = Router()

router.use(protect)

router.post('/start-face-scan', authLimiter, kyc.startFaceScan)
router.post('/complete-face-scan', authLimiter, validate(completeFaceScanSchema), kyc.completeFaceScan)

export default router
