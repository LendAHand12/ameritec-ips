import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRightIcon, MailIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import AuthCard from '@/components/auth/AuthCard'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import OtpInput from '@/components/auth/OtpInput'
import { useCountdown } from '@/hooks/useCountdown'
import { normalizeEmail } from '@/lib/normalize'
import { resendVerification, verifyEmail } from '@/services/auth.service'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const email = normalizeEmail(searchParams.get('email'))
  const shouldResend = searchParams.get('resend') === '1'

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  // Coming straight from registration the code was just sent
  const [cooldown, setCooldown] = useCountdown(location.state?.emailSent ? 60 : 0)
  const autoResent = useRef(false)

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      const { resendAfter } = await resendVerification(email)
      setCooldown(resendAfter ?? 60)
      toast.success('A new code has been sent to your email')
    } catch (err) {
      if (err.code === 'RESEND_COOLDOWN') setCooldown(err.details?.retryAfter ?? 60)
      else toast.error(err.message)
    } finally {
      setResending(false)
    }
  }

  // Arriving from login with an unverified email: send a fresh code once
  useEffect(() => {
    if (!email || !shouldResend || autoResent.current) return
    autoResent.current = true
    handleResend()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, shouldResend])

  const handleVerify = async (value = code) => {
    if (value.length !== 6) return setError('Enter the 6-digit code')
    setVerifying(true)
    setError('')
    try {
      const application = await verifyEmail(email, value)
      navigate('/application-status', { replace: true, state: application })
    } catch (err) {
      setError(err.message)
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  const wrap = (content) => (
    <div className="flex w-full max-w-[550px] flex-1 flex-col justify-center py-[37.5px]">{content}</div>
  )

  if (!email) {
    return wrap(
      <AuthCard icon={MailIcon} title="Email verification" description="The verification link is incomplete. Please sign in to continue.">
        <Link to="/login" className={buttonVariants({ size: 'xl', className: 'w-full' })}>Go to Sign In</Link>
      </AuthCard>,
    )
  }

  return wrap(
    <AuthCard
      icon={MailIcon}
      title="Check your email"
      description={
        <>
          We sent a 6-digit code to <span className="font-semibold text-foreground">{email}</span>. Enter it below to
          confirm your email address.
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v)
            setError('')
          }}
          onComplete={handleVerify}
          disabled={verifying}
          invalid={!!error}
        />
        <FieldError>{error}</FieldError>
      </div>
      <Button size="xl" className="mt-[22.5px] w-full" onClick={() => handleVerify()} disabled={verifying || code.length !== 6}>
        Verify Email
        {verifying ? <Spinner className="size-5" /> : <ArrowRightIcon />}
      </Button>
      <p className="pt-[17.5px] text-center text-caption text-muted-foreground">
        Didn’t receive the code?{' '}
        <button
          type="button"
          className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-subtle disabled:no-underline"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </p>
    </AuthCard>,
  )
}
