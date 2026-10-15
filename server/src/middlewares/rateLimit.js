import rateLimit from 'express-rate-limit'

const limiter = (windowMinutes, limit) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
  })

export const authLimiter = limiter(15, 30)
export const otpLimiter = limiter(15, 10)
