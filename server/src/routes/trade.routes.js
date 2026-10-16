import { Router } from 'express'
import * as trade from '../controllers/trade.controller.js'
import { protect } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { authLimiter } from '../middlewares/rateLimit.js'
import { createOrderSchema, listOrdersQuerySchema, submitPaymentSchema } from '../validators/trade.validator.js'

const router = Router()

router.use(protect)

router.get('/config', trade.getTradeConfig)
router.get('/portfolio', trade.getPortfolio)
router.get('/zelle-qr', trade.getZelleQr)
router.get('/orders', validate(listOrdersQuerySchema, 'query'), trade.listMyOrders)
router.post('/orders', authLimiter, validate(createOrderSchema), trade.createOrder)
router.get('/orders/:id', trade.getMyOrder)
router.post('/orders/:id/start-payment', authLimiter, trade.startPayment)
router.post('/orders/:id/pay', authLimiter, validate(submitPaymentSchema), trade.submitPayment)
router.post('/orders/:id/refresh', trade.refreshPayment)
router.post('/orders/:id/cancel', trade.cancelOrder)
router.get('/orders/:id/certificate', trade.downloadCertificate)

export default router
