import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRightIcon, CheckCircle2Icon, MailIcon, ScanFaceIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import AuthCard from '@/components/auth/AuthCard'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import OtpInput from '@/components/auth/OtpInput'
import { useAuth } from '@/hooks/useAuth'
import { useCountdown } from '@/hooks/useCountdown'
import { normalizeEmail } from '@/lib/normalize'
import { resendVerification, verifyEmail } from '@/services/auth.service'
import { startFaceScan } from '@/services/kyc.service'

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
  const { setUser } = useAuth()
  // Set once the email is verified: the server has signed the user in, and we offer the face scan before moving on
  const [verifiedUser, setVerifiedUser] = useState(null)
  const [startingFace, setStartingFace] = useState(false)

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
      const res = await verifyEmail(email, value)
      if (res.user) setVerifiedUser(res.user)
      else navigate('/application-status', { replace: true, state: res })
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

  // Hands the browser to the FaceTec page; it comes back to /user/kyc-callback (the session cookie is already set)
  const beginFaceScan = async () => {
    setStartingFace(true)
    try {
      const { url } = await startFaceScan()
      window.location.assign(url)
    } catch (err) {
      toast.error(err.message)
      setStartingFace(false)
    }
  }

  if (verifiedUser) {
    return wrap(
      <AuthCard
        icon={CheckCircle2Icon}
        title="Your email is verified"
        description="Your account is ready — you can sign in, buy shares and invite referrals right away."
      >
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ScanFaceIcon className="size-8" />
          </span>
          <h3 className="text-title font-bold">Scan your face now?</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            It takes about a minute. You need an approved face scan to withdraw commission, and the commission your referrer earns from your
            purchases is held until it’s approved. You can also do it later from Account &amp; Security.
          </p>
        </div>
        <div className="mt-[22.5px] flex flex-col gap-3">
          <Button size="xl" className="w-full" onClick={beginFaceScan} disabled={startingFace}>
            {startingFace ? <Spinner className="size-5" /> : <ScanFaceIcon />}
            Scan my face now
          </Button>
          {/* Setting the user lets the guest route move on to the dashboard */}
          <Button size="xl" variant="outline" className="w-full bg-card" onClick={() => setUser(verifiedUser)} disabled={startingFace}>
            Skip for now
          </Button>
        </div>
      </AuthCard>,
    )
  }

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
