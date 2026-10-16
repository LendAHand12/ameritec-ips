import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2Icon, CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import OtpInput from '@/components/auth/OtpInput'
import { setupTwoFactor, verifyTwoFactorSetup } from '@/services/auth.service'
import StepActions from './StepActions'

export default function StepTwoFactor({ email, value, onBack, onNext }) {
  // value = { email, twoFactorToken } once verified for this email
  const alreadyVerified = value?.email === email && !!value?.twoFactorToken
  const [setup, setSetup] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(alreadyVerified ? value : null)
  const requested = useRef(false)

  const loadSetup = useCallback(async () => {
    setLoadError('')
    setSetup(null)
    setCode('')
    try {
      setSetup(await setupTwoFactor(email))
    } catch (err) {
      setLoadError(err.message)
    }
  }, [email])

  useEffect(() => {
    if (verified || requested.current) return
    requested.current = true
    loadSetup()
  }, [verified, loadSetup])

  const handleVerify = async (input = code) => {
    if (input.length !== 6) return setError('Enter the 6-digit code')
    setVerifying(true)
    setError('')
    try {
      const { twoFactorToken } = await verifyTwoFactorSetup(setup.setupToken, input)
      setVerified({ email, twoFactorToken })
    } catch (err) {
      if (err.code === 'TWO_FACTOR_SETUP_EXPIRED') {
        toast.error(err.message)
        loadSetup()
      } else {
        setError(err.message)
        setCode('')
      }
    } finally {
      setVerifying(false)
    }
  }

  const copySecret = async () => {
    await navigator.clipboard.writeText(setup.secret)
    toast.success('Secret key copied')
  }

  const restart = () => {
    setVerified(null)
    loadSetup()
  }

  if (verified) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 rounded-lg border px-6 py-10 text-center">
          <CheckCircle2Icon className="size-10 text-green-600" />
          <div className="font-medium">Google Authenticator is linked</div>
          <p className="text-sm text-muted-foreground">You'll be asked for a code from the app every time you sign in.</p>
          <Button variant="link" className="h-auto p-0" onClick={restart}>
            Set up again
          </Button>
        </div>
        <StepActions onBack={onBack} onNext={() => onNext(verified)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Install Google Authenticator (or any TOTP app) on your phone.</li>
        <li>Scan the QR code below, or enter the secret key manually.</li>
        <li>Enter the 6-digit code shown in the app to confirm.</li>
      </ol>

      <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
        {loadError ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <FieldError>{loadError}</FieldError>
            <Button variant="outline" size="sm" onClick={loadSetup}>
              Try again
            </Button>
          </div>
        ) : !setup ? (
          <div className="flex size-48 items-center justify-center">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <>
            <img src={setup.qrCode} alt="Two-factor authentication QR code" className="size-48 rounded-md bg-white p-2" />
            <div className="flex w-full max-w-sm items-center gap-2 rounded-md bg-muted px-3 py-2">
              <code className="flex-1 font-mono text-xs break-all">{setup.secret}</code>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Copy secret key" onClick={copySecret}>
                <CopyIcon />
              </Button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v)
                  setError('')
                }}
                onComplete={handleVerify}
                disabled={verifying}
                invalid={!!error}
                autoFocus={false}
              />
              <FieldError>{error}</FieldError>
            </div>
          </>
        )}
      </div>

      <StepActions
        onBack={onBack}
        nextLabel="Verify & continue"
        onNext={() => handleVerify()}
        nextDisabled={!setup || code.length !== 6}
        loading={verifying}
      />
      <button type="button" onClick={() => onNext(null)} className="-mt-2 self-center text-title font-semibold text-primary hover:underline">
        Skip for now — I’ll turn it on later
      </button>
    </div>
  )
}
