import { z } from 'zod'
import { getCountries } from 'libphonenumber-js/max'
import { DOCUMENT_TYPES } from '../models/User.js'
import { normalizeEmail, normalizeFullName, normalizeReferralCode } from '../utils/normalize.js'

const COUNTRIES = new Set(getCountries())

export const emailSchema = z
  .string({ error: 'Email is required' })
  .transform(normalizeEmail)
  .pipe(z.email('Invalid email address').max(254, 'Email is too long'))

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9\s]/, 'Password must contain a special character')

const phoneCountrySchema = z
  .string({ error: 'Country code is required' })
  .trim()
  .toUpperCase()
  .refine((c) => COUNTRIES.has(c), 'Invalid country code')

const phoneNumberSchema = z.string({ error: 'Phone number is required' }).trim().min(1, 'Phone number is required')

const otpSchema = z
  .string({ error: 'Code is required' })
  .trim()
  .regex(/^\d{6}$/, 'Code must be 6 digits')

export const accountInfoSchema = z
  .object({
    fullName: z
      .string({ error: 'Full name is required' })
      .transform(normalizeFullName)
      .pipe(z.string().min(2, 'Full name is too short').max(100, 'Full name is too long')),
    email: emailSchema,
    phoneCountry: phoneCountrySchema,
    phoneNumber: phoneNumberSchema,
    referralCode: z
      .string({ error: 'Referral code is required' })
      .transform((v) => normalizeReferralCode(v))
      .pipe(z.string().min(1, 'Referral code is required')),
    password: passwordSchema,
    confirmPassword: z.string({ error: 'Please confirm your password' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const registerSchema = accountInfoSchema.and(
  z.object({
    documentType: z.enum(DOCUMENT_TYPES, { error: 'Invalid document type' }),
    // multipart sends booleans as strings
    acceptTerms: z.literal('true', { error: 'Please accept the Terms of Service and Privacy Policy' }),
    // Optional: two-factor can be switched on later from Account & Security
    twoFactorToken: z.string().optional(),
  }),
)

export const twoFactorSetupSchema = z.object({ email: emailSchema })

export const twoFactorVerifySetupSchema = z.object({
  setupToken: z.string().min(1),
  code: otpSchema,
})

export const verifyEmailSchema = z.object({ email: emailSchema, code: otpSchema })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: otpSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: 'Please confirm your password' }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export const resendVerificationSchema = z.object({ email: emailSchema })

export const loginSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('email'),
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean().optional().default(false),
  }),
  z.object({
    method: z.literal('phone'),
    phoneCountry: phoneCountrySchema,
    phoneNumber: phoneNumberSchema,
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean().optional().default(false),
  }),
])

export const loginTwoFactorSchema = z.object({
  loginToken: z.string().min(1),
  code: otpSchema,
})
