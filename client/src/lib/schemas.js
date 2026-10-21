import { z } from 'zod'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { normalizeEmail, normalizeReferralCode } from './normalize'

// Mirrors server/src/validators/auth.validator.js — the server stays the source of truth

export const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.string().min(1, 'Email is required').pipe(z.email('Invalid email address')))

/** Shown as a live checklist under the password field. */
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'case', label: 'Uppercase and lowercase letter', test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: 'number', label: 'Number', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'Special character', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
]

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9\s]/, 'Password must contain a special character')

export const otpSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code')

export const accountInfoSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is too short').max(100, 'Full name is too long'),
    email: emailSchema,
    phoneCountry: z.string().min(1, 'Select a country code'),
    phoneNumber: z.string().trim().min(1, 'Phone number is required'),
    referralCode: z.string().transform((v) => normalizeReferralCode(v)).pipe(z.string().min(1, 'Referral code is required')),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, { error: 'Please accept the Terms of Service and Privacy Policy' }),
  })
  .superRefine((d, ctx) => {
    if (!isValidPhoneNumber(d.phoneNumber, d.phoneCountry)) {
      ctx.addIssue({ code: 'custom', path: ['phoneNumber'], message: 'Invalid phone number' })
    }
    if (d.password !== d.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' })
    }
  })

/** Login takes one "email or phone number" field; phone numbers without +code use the browser's country. */
export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Enter your email or phone number'),
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean(),
    defaultCountry: z.string(),
  })
  .superRefine((d, ctx) => {
    const valid = d.identifier.includes('@')
      ? emailSchema.safeParse(d.identifier).success
      : isValidPhoneNumber(d.identifier, d.defaultCountry)
    if (!valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['identifier'],
        message: d.identifier.includes('@')
          ? 'Invalid email address'
          : 'Invalid phone number — include your country code, e.g. +84 901 234 567',
      })
    }
  })
  .transform(({ identifier, password, remember, defaultCountry }) =>
    identifier.includes('@')
      ? { method: 'email', email: normalizeEmail(identifier), password, remember }
      : { method: 'phone', phoneNumber: identifier, phoneCountry: defaultCountry, password, remember },
  )

export const supportRequestSchema = z.object({
  category: z.string().min(1, 'Choose an issue type'),
  errorCode: z.string().trim().max(30, 'Must be at most 30 characters'),
  relatedTransaction: z.string().trim().max(50, 'Must be at most 50 characters'),
  subject: z.string().trim().min(1, 'Enter a subject').max(150, 'Subject must be at most 150 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Please describe the issue in a bit more detail')
    .max(1000, 'Description must be at most 1,000 characters'),
})
