import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { guessDefaultCountry } from '@/lib/countries'
import { normalizeReferralCode } from '@/lib/normalize'
import { REFERRAL_PARAM, clearStoredReferralCode, getStoredReferralCode } from '@/lib/referral'
import { register } from '@/services/auth.service'
import AuthCard from '@/components/auth/AuthCard'
import { ACCOUNT_FIELDS, STEPS, STEP_INDEX } from './constants'
import Stepper from './Stepper'
import StepAccountInfo from './StepAccountInfo'
import StepIdentity from './StepIdentity'
import StepFaceId from './StepFaceId'
import StepTwoFactor from './StepTwoFactor'
import StepReview from './StepReview'

const pick = (obj, keys) => Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => keys.includes(k)))

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  // Field errors from the final submit, shown when the user is sent back to the relevant step
  const [serverErrors, setServerErrors] = useState(null)
  const [data, setData] = useState(() => ({
    account: {
      fullName: '',
      email: '',
      phoneCountry: guessDefaultCountry(),
      phoneNumber: '',
      // The URL wins on first render; ReferralTracker stores it for later visits
      referralCode: normalizeReferralCode(searchParams.get(REFERRAL_PARAM)) || getStoredReferralCode(),
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
    referrer: null,
    identity: { documentType: 'national_id', front: null, back: null, supporting: null },
    face: null,
    twoFactor: null,
  }))

  // Warn before leaving once the user has started filling in the form
  const dirty = step > 0
  useEffect(() => {
    if (!dirty) return
    const handler = (e) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const goTo = (index) => {
    setStep(index)
    window.scrollTo({ top: 0 })
  }

  const update = (patch, nextStep) => {
    setData((prev) => ({ ...prev, ...patch }))
    if (nextStep !== undefined) goTo(nextStep)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const { email, emailSent } = await register(data)
      clearStoredReferralCode()
      if (!emailSent) toast.warning("We couldn't send the verification email. Use \"Resend code\" to try again.")
      navigate(`/verify-email?email=${encodeURIComponent(email)}`, { replace: true, state: { emailSent } })
    } catch (err) {
      toast.error(err.message)
      const details = err.details ?? {}
      if (err.code === 'TWO_FACTOR_SETUP_EXPIRED') {
        update({ twoFactor: null }, STEP_INDEX.twoFactor)
      } else if (Object.keys(pick(details, ACCOUNT_FIELDS)).length) {
        setServerErrors(pick(details, ACCOUNT_FIELDS))
        goTo(STEP_INDEX.account)
      } else if (details.documentFront || details.documentBack || details.supportingDocument) {
        setServerErrors({ front: details.documentFront, back: details.documentBack, supporting: details.supportingDocument })
        goTo(STEP_INDEX.identity)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const back = () => goTo(step - 1)

  const { icon: StepIcon, title, description } = STEPS[step]

  return (
    <div className="w-full max-w-[975px]">
      <Stepper current={step} />

      <AuthCard icon={StepIcon} title={title} description={description} className="mt-[32.5px]">
        <div>
          {step === STEP_INDEX.account && (
            <StepAccountInfo
              defaultValues={data.account}
              serverErrors={serverErrors}
              onNext={(account, referrer) => {
                setServerErrors(null)
                // 2FA is bound to the email it was set up with
                const twoFactor = data.twoFactor?.email === account.email ? data.twoFactor : null
                update({ account, referrer, twoFactor }, STEP_INDEX.identity)
              }}
            />
          )}
          {step === STEP_INDEX.identity && (
            <StepIdentity
              value={data.identity}
              serverErrors={serverErrors}
              onBack={(identity) => update({ identity }, STEP_INDEX.account)}
              onNext={(identity) => {
                setServerErrors(null)
                update({ identity }, STEP_INDEX.face)
              }}
            />
          )}
          {step === STEP_INDEX.face && <StepFaceId value={data.face} onBack={back} onNext={(face) => update({ face }, STEP_INDEX.twoFactor)} />}
          {step === STEP_INDEX.twoFactor && (
            <StepTwoFactor
              email={data.account.email}
              value={data.twoFactor}
              onBack={back}
              onNext={(twoFactor) => update({ twoFactor }, STEP_INDEX.review)}
            />
          )}
          {step === STEP_INDEX.review && (
            <StepReview data={data} onEdit={goTo} onBack={back} onSubmit={handleSubmit} submitting={submitting} />
          )}
        </div>

        <p className="pt-[17.5px] text-center text-title text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="ml-2 text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </AuthCard>
    </div>
  )
}
