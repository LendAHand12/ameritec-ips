import { ClipboardCheckIcon, KeyRoundIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react'

export const STEPS = [
  {
    id: 'account',
    label: 'Create Account',
    icon: UsersIcon,
    title: 'Create your Ameritec account',
    description: 'Start your Pre-IPO registration.',
  },
  {
    id: 'identity',
    label: 'Identity Verification',
    icon: ShieldCheckIcon,
    title: 'Verify your identity',
    description: 'Provide the required documents to verify your identity.',
  },
  {
    id: 'twoFactor',
    label: 'Secure Account',
    icon: KeyRoundIcon,
    title: 'Secure your account (optional)',
    description: 'Add two-factor authentication with Google Authenticator — you can also turn it on later.',
  },
  {
    id: 'review',
    label: 'Application Submitted',
    icon: ClipboardCheckIcon,
    title: 'Review your application',
    description: 'Check your details before submitting.',
  },
]

export const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]))

export const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'National ID', description: 'Government-issued national identity card' },
  { value: 'passport', label: 'Passport', description: 'International passport' },
  { value: 'drivers_license', label: 'Driver’s License', description: 'Valid driving licence' },
]

export const DOCUMENT_LABEL = Object.fromEntries(DOCUMENT_TYPES.map((d) => [d.value, d.label]))

export const ACCOUNT_FIELDS = ['fullName', 'email', 'phoneCountry', 'phoneNumber', 'referralCode', 'password', 'confirmPassword']
