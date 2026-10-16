import { useState } from 'react'
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import FaceCapture from '@/components/account/FaceCapture'
import OtpInput from '@/components/auth/OtpInput'
import PasswordInput from '@/components/auth/PasswordInput'
import { disableTwoFactor, enableTwoFactor, setupTwoFactor, submitFace } from '@/services/account.service'

/** Add (or retake) the face scan. It goes to our team for approval. */
export function FaceScanDialog({ open, onClose, onSubmitted }) {
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await submitFace(file)
      toast.success('Face scan sent for review')
      onSubmitted()
    } catch (err) {
      toast.error(err.details?.face ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-subheading font-bold">Add your face scan</DialogTitle>
          <DialogDescription>Take a clear selfie. Our team reviews it — until it’s approved, commission your referrer earns from your purchases stays on hold.</DialogDescription>
        </DialogHeader>
        <FaceCapture value={file} onChange={setFile} disabled={saving} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!file || saving}>
            {saving && <Spinner />}
            Send for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Turn two-factor on: confirm the password, scan the QR code, enter a code from the app. */
export function EnableTwoFactorDialog({ open, onClose, onEnabled }) {
  const [step, setStep] = useState('password') // 'password' → 'scan'
  const [password, setPassword] = useState('')
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async (e) => {
    e.preventDefault()
    if (!password) return setError('Enter your password')
    setBusy(true)
    try {
      setSetup(await setupTwoFactor(password))
      setStep('scan')
      setError('')
    } catch (err) {
      setError(err.details?.password ?? err.message)
    } finally {
      setBusy(false)
    }
  }

  const finish = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return setError('Enter the 6-digit code')
    setBusy(true)
    try {
      await enableTwoFactor(setup.setupToken, value)
      toast.success('Two-factor authentication is on')
      onEnabled()
    } catch (err) {
      if (err.code === 'TWO_FACTOR_SETUP_EXPIRED') {
        toast.error(err.message)
        setStep('password')
        setSetup(null)
      } else {
        setError(err.details?.code ?? err.message)
      }
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-subheading font-bold">Turn on two-factor authentication</DialogTitle>
          <DialogDescription>
            {step === 'password' ? 'Confirm your password to continue.' : 'Scan the QR code with Google Authenticator (or any TOTP app), then enter the 6-digit code.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'password' ? (
          <form onSubmit={start} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="twofa-password" className="text-caption font-semibold">
                Password
              </label>
              <PasswordInput
                id="twofa-password"
                size="lg"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                aria-invalid={!!error}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Spinner />}
                Continue
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
              <img src={setup.qrCode} alt="Two-factor authentication QR code" className="size-44 rounded-md bg-white p-2" />
              <div className="flex w-full max-w-sm items-center gap-2 rounded-md bg-muted px-3 py-2">
                <code className="flex-1 font-mono text-xs break-all">{setup.secret}</code>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Copy secret key" onClick={() => navigator.clipboard.writeText(setup.secret).then(() => toast.success('Secret key copied'))}>
                  <CopyIcon />
                </Button>
              </div>
              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v)
                  setError('')
                }}
                onComplete={finish}
                disabled={busy}
                invalid={!!error}
                autoFocus={false}
              />
              <FieldError>{error}</FieldError>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => finish()} disabled={busy || code.length !== 6}>
                {busy && <Spinner />}
                Turn on
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Turning it off needs the password and a current code, so a stolen session can't weaken the account. */
export function DisableTwoFactorDialog({ open, onClose, onDisabled }) {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!password) next.password = 'Enter your password'
    if (!/^\d{6}$/.test(code)) next.code = 'Enter the 6-digit code'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await disableTwoFactor(password, code)
      toast.success('Two-factor authentication is off')
      onDisabled()
    } catch (err) {
      setErrors({ password: err.details?.password, code: err.details?.code ?? (err.details?.password ? undefined : err.message) })
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Turn off two-factor authentication</DialogTitle>
            <DialogDescription>You’ll sign in and confirm sensitive changes with just your password. We recommend keeping it on.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="disable-password" className="text-caption font-semibold">
              Password
            </label>
            <PasswordInput
              id="disable-password"
              size="lg"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors((x) => ({ ...x, password: undefined }))
              }}
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <p className="text-caption font-semibold">Authenticator code</p>
            <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/60 py-4">
              <OtpInput value={code} onChange={(v) => { setCode(v); setErrors((x) => ({ ...x, code: undefined })) }} disabled={busy} invalid={!!errors.code} autoFocus={false} />
              <FieldError>{errors.code}</FieldError>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy && <Spinner />}
              Turn off
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
