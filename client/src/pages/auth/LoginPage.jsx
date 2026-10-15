import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRightIcon, KeyRoundIcon, ShieldCheckIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import AuthCard from '@/components/auth/AuthCard'
import FormField from '@/components/auth/FormField'
import OtpInput from '@/components/auth/OtpInput'
import PasswordInput from '@/components/auth/PasswordInput'
import { useAuth } from '@/hooks/useAuth'
import { applyFieldErrors } from '@/lib/api'
import { guessDefaultCountry } from '@/lib/countries'
import { normalizeEmail } from '@/lib/normalize'
import { loginSchema } from '@/lib/schemas'
import * as authService from '@/services/auth.service'

function TwoFactorStep({ loginToken, onSuccess, onBack }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (value = code) => {
    if (value.length !== 6) return setError('Enter the 6-digit code')
    setSubmitting(true)
    setError('')
    try {
      const { user } = await authService.loginTwoFactor(loginToken, value)
      onSuccess(user)
    } catch (err) {
      if (err.code === 'LOGIN_EXPIRED') return onBack(err.message)
      setError(err.message)
      setCode('')
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      icon={KeyRoundIcon}
      title="Two-factor authentication"
      description="Enter the 6-digit code from your Google Authenticator app."
    >
      <div className="flex flex-col items-center gap-3">
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v)
            setError('')
          }}
          onComplete={submit}
          disabled={submitting}
          invalid={!!error}
        />
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

/** Email: no spaces, lower-cased on blur. Phone: left as typed (spaces allowed). */
function IdentifierInput({ onChange, onBlur, ...props }) {
  const handleBlur = (e) => {
    const value = e.target.value
    if (value.includes('@')) {
      const normalized = normalizeEmail(value).replace(/\s/g, '')
      if (normalized !== value) {
        e.target.value = normalized
        onChange?.(e)
      }
    }
    onBlur?.(e)
  }

  return (
    <Input
      type="text"
      autoComplete="username"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      onChange={onChange}
      onBlur={handleBlur}
      {...props}
    />
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const [loginToken, setLoginToken] = useState(null)
  const [alert, setAlert] = useState(null)

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', remember: false, defaultCountry: guessDefaultCountry() },
  })

  const finishLogin = (user) => {
    setUser(user)
    navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true })
  }

  const onSubmit = async (payload) => {
    setAlert(null)
    try {
      const res = await authService.login(payload)
      if (res.requiresTwoFactor) setLoginToken(res.loginToken)
      else finishLogin(res.user)
    } catch (err) {
      switch (err.code) {
        case 'EMAIL_NOT_VERIFIED':
          return navigate(`/verify-email?email=${encodeURIComponent(err.details.email)}&resend=1`)
        case 'ACCOUNT_PENDING':
        case 'ACCOUNT_REJECTED':
          return navigate('/application-status', { state: err.details })
        default: {
          // Server field names → the single identifier field
          const details = err.details && {
            identifier: err.details.email ?? err.details.phoneNumber,
            password: err.details.password,
          }
          if (!applyFieldErrors({ details }, setError, ['identifier', 'password'])) {
            setAlert({ title: 'Sign in failed', description: err.message })
          }
        }
      }
    }
  }

  return (
    <div className="flex w-full max-w-[550px] flex-1 flex-col justify-center py-[37.5px]">
      {loginToken ? (
        <TwoFactorStep
          loginToken={loginToken}
          onSuccess={finishLogin}
          onBack={(message) => {
            setLoginToken(null)
            if (message) setAlert({ title: 'Sign in again', description: message })
          }}
        />
      ) : (
        <AuthCard icon={ShieldCheckIcon} title="Welcome back" description="Sign in to your Ameritec IPS account.">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {alert && (
              <Alert variant="destructive" className="mb-[17.5px]">
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-[17.5px]">
              <FormField id="identifier" label="Email or Phone Number" labelSize="caption" required error={errors.identifier}>
                <IdentifierInput
                  id="identifier"
                  size="lg"
                  className="h-[57.5px]"
                  placeholder="Email address or phone number"
                  aria-invalid={!!errors.identifier}
                  {...register('identifier')}
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

            <div className="flex items-center justify-between gap-4 pt-[16.25px]">
              <label className="flex cursor-pointer items-center gap-2.5 text-caption text-muted-foreground">
                <Controller
                  name="remember"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      className="size-[21.25px] rounded-[5px] [&_svg]:size-4!"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-caption font-semibold text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" size="xl" className="mt-[22.5px] w-full" disabled={isSubmitting}>
              Sign In
              {isSubmitting ? <Spinner className="size-5" /> : <ArrowRightIcon />}
            </Button>

            <p className="pt-[17.5px] text-center text-caption text-muted-foreground">
              Don’t have an account?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Create Account
              </Link>
            </p>
          </form>
        </AuthCard>
      )}
    </div>
  )
}
