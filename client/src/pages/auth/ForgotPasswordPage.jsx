import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRightIcon, KeyRoundIcon, MailIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import AuthCard from '@/components/auth/AuthCard'
import FormField from '@/components/auth/FormField'
import OtpInput from '@/components/auth/OtpInput'
import PasswordInput from '@/components/auth/PasswordInput'
import PasswordRequirements from '@/components/auth/PasswordRequirements'
import { useCountdown } from '@/hooks/useCountdown'
import { normalizeEmail } from '@/lib/normalize'
import { emailSchema, otpSchema, passwordSchema } from '@/lib/schemas'
import * as authService from '@/services/auth.service'

const wrap = (content) => <div className="flex w-full max-w-[550px] flex-1 flex-col justify-center py-[37.5px]">{content}</div>

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // 'email' → 'reset'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useCountdown(0)

  const sendCode = async (e) => {
    e?.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) return setErrors({ email: parsed.error.issues[0].message })
    setSubmitting(true)
    setErrors({})
    try {
      const { resendAfter } = await authService.forgotPassword(parsed.data)
      setEmail(parsed.data)
      setCooldown(resendAfter ?? 60)
      setStep('reset')
    } catch (err) {
      setErrors({ email: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    try {
      const { resendAfter } = await authService.forgotPassword(email)
      setCooldown(resendAfter ?? 60)
      toast.success('If the account exists, a new code is on its way')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const resetPassword = async (e) => {
    e.preventDefault()
    const next = {}
    if (!otpSchema.safeParse(code).success) next.code = 'Enter the 6-digit code'
    const pw = passwordSchema.safeParse(password)
    if (!pw.success) next.password = pw.error.issues[0].message
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match'
    setErrors(next)
    if (Object.keys(next).length) return

    setSubmitting(true)
    try {
      await authService.resetPassword({ email, code, password, confirmPassword })
      toast.success('Password updated. Please sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (err) {
      setErrors({ code: err.details?.code ?? undefined, password: err.details?.password, confirmPassword: err.details?.confirmPassword, form: err.message })
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'email') {
    return wrap(
      <AuthCard icon={KeyRoundIcon} title="Forgot password" description="Enter your account email and we’ll send you a 6-digit code to reset your password.">
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-[22.5px]">
          <FormField id="email" label="Email" labelSize="caption" required error={errors.email}>
            <Input
              id="email"
              type="email"
              size="lg"
              className="h-[57.5px]"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Email address"
              value={email}
              onChange={(e) => {
                setEmail(normalizeEmail(e.target.value).replace(/\s/g, ''))
                setErrors({})
              }}
              aria-invalid={!!errors.email}
            />
          </FormField>
          <Button type="submit" size="xl" className="w-full" disabled={submitting}>
            Send Code
            {submitting ? <Spinner className="size-5" /> : <ArrowRightIcon />}
          </Button>
          <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'xl', className: 'w-full bg-card' })}>
            Back to Sign In
          </Link>
        </form>
      </AuthCard>,
    )
  }

  return wrap(
    <AuthCard
      icon={MailIcon}
      title="Reset your password"
      description={
        <>
          If <span className="font-semibold text-foreground">{email}</span> has an account, we sent it a 6-digit code. Enter it below with your new password.
        </>
      }
    >
      <form onSubmit={resetPassword} noValidate className="flex flex-col gap-[17.5px]">
        {errors.form && <FieldError>{errors.form}</FieldError>}
        <div className="flex flex-col items-center gap-3">
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v)
              setErrors((x) => ({ ...x, code: undefined, form: undefined }))
            }}
            disabled={submitting}
            invalid={!!errors.code}
          />
          <FieldError>{errors.code}</FieldError>
        </div>

        <FormField id="new-password" label="New Password" labelSize="caption" required error={errors.password}>
          <PasswordInput
            id="new-password"
            size="lg"
            className="data-[size=lg]:h-[57.5px]"
            autoComplete="new-password"
            placeholder="Enter a new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
          />
        </FormField>
        <PasswordRequirements value={password} />
        <FormField id="confirm-password" label="Confirm New Password" labelSize="caption" required error={errors.confirmPassword}>
          <PasswordInput
            id="confirm-password"
            size="lg"
            className="data-[size=lg]:h-[57.5px]"
            autoComplete="new-password"
            placeholder="Re-enter the new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={!!errors.confirmPassword}
          />
        </FormField>

        <Button type="submit" size="xl" className="w-full" disabled={submitting || code.length !== 6}>
          Reset Password
          {submitting ? <Spinner className="size-5" /> : <ArrowRightIcon />}
        </Button>
      </form>
      <p className="pt-[17.5px] text-center text-caption text-muted-foreground">
        Didn’t receive the code?{' '}
        <button
          type="button"
          className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-subtle disabled:no-underline"
          onClick={resend}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
        {' · '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to Sign In
        </Link>
      </p>
    </AuthCard>,
  )
}
