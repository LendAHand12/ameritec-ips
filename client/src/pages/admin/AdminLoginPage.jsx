import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ArrowRightIcon, KeyRoundIcon, LockKeyholeIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import AuthCard from '@/components/auth/AuthCard'
import EmailInput from '@/components/auth/EmailInput'
import FormField from '@/components/auth/FormField'
import OtpInput from '@/components/auth/OtpInput'
import PasswordInput from '@/components/auth/PasswordInput'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { emailSchema } from '@/lib/schemas'
import { adminLogin, adminLoginTwoFactor } from '@/services/admin.service'

const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

/** Second step for admins who turned two-factor on. */
function TwoFactorStep({ loginToken, onSuccess, onBack }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (value = code) => {
    if (value.length !== 6) return setError('Enter the 6-digit code')
    setSubmitting(true)
    setError('')
    try {
      const { admin } = await adminLoginTwoFactor(loginToken, value)
      onSuccess(admin)
    } catch (err) {
      if (err.code === 'LOGIN_EXPIRED') return onBack(err.message)
      setError(err.message)
      setCode('')
      setSubmitting(false)
    }
  }

  return (
    <AuthCard icon={KeyRoundIcon} title="Two-factor authentication" description="Enter the 6-digit code from your authenticator app.">
      <div className="flex flex-col items-center gap-3">
        <OtpInput value={code} onChange={(v) => { setCode(v); setError('') }} onComplete={submit} disabled={submitting} invalid={!!error} />
        <FieldError>{error}</FieldError>
      </div>
      <div className="grid gap-[11.25px] pt-[25px] sm:grid-cols-[2fr_3fr]">
        <Button size="xl" className="w-full sm:order-last" onClick={() => submit()} disabled={submitting || code.length !== 6}>
          Verify
          {submitting ? <Spinner className="size-5" /> : <ArrowRightIcon />}
        </Button>
        <Button variant="outline" size="xl" className="w-full bg-card" onClick={() => onBack()} disabled={submitting}>
          Back
        </Button>
      </div>
    </AuthCard>
  )
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAdmin } = useAdminAuth()
  const [error, setError] = useState('')
  const [loginToken, setLoginToken] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(adminLoginSchema), defaultValues: { email: '', password: '' } })

  const finish = (admin) => {
    setAdmin(admin)
    navigate(location.state?.from?.pathname ?? '/admin', { replace: true })
  }

  const onSubmit = async (values) => {
    setError('')
    try {
      const res = await adminLogin(values)
      if (res.requiresTwoFactor) return setLoginToken(res.loginToken)
      finish(res.admin)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loginToken) {
    return (
      <div className="flex w-full max-w-[550px] flex-1 flex-col justify-center py-[37.5px]">
        <TwoFactorStep
          loginToken={loginToken}
          onSuccess={finish}
          onBack={(message) => {
            setLoginToken(null)
            if (message) setError(message)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-[550px] flex-1 flex-col justify-center py-[37.5px]">
      <AuthCard icon={LockKeyholeIcon} title="Admin Portal" description="Sign in with your administrator account.">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {error && (
            <Alert variant="destructive" className="mb-[17.5px]">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-[17.5px]">
            <FormField id="email" label="Email" labelSize="caption" required error={errors.email}>
              <EmailInput
                id="email"
                size="lg"
                className="h-[57.5px]"
                autoComplete="username"
                placeholder="admin@example.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
            </FormField>
            <FormField id="password" label="Password" labelSize="caption" required error={errors.password}>
              <PasswordInput
                id="password"
                size="lg"
                className="data-[size=lg]:h-[57.5px]"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
            </FormField>
          </div>
          <Button type="submit" size="xl" className="mt-[22.5px] w-full" disabled={isSubmitting}>
            Sign In
            {isSubmitting ? <Spinner className="size-5" /> : <ArrowRightIcon />}
          </Button>
        </form>
      </AuthCard>
    </div>
  )
}
