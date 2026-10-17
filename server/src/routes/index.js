import { Router } from 'express'
import authRoutes from './auth.routes.js'
import adminRoutes from './admin.routes.js'
import tradeRoutes from './trade.routes.js'
import referralRoutes from './referral.routes.js'
import supportRoutes from './support.routes.js'
import accountRoutes from './account.routes.js'
import kycRoutes from './kyc.routes.js'

const router = Router()

router.get('/health', (req, res) => res.json({ status: 'ok' }))
router.use('/auth', authRoutes)
router.use('/admin', adminRoutes)
router.use('/trade', tradeRoutes)
router.use('/referrals', referralRoutes)
router.use('/support', supportRoutes)
router.use('/account', accountRoutes)
router.use('/kyc', kycRoutes)

export default router
