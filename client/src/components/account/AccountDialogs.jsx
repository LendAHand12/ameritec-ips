import { useState } from 'react'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import ConfirmIdentity, { confirmError, confirmPayload } from '@/components/auth/ConfirmIdentity'
import PasswordInput from '@/components/auth/PasswordInput'
import PasswordRequirements from '@/components/auth/PasswordRequirements'
import PhoneInput from '@/components/auth/PhoneInput'
import { useAuth } from '@/hooks/useAuth'
import { guessDefaultCountry } from '@/lib/countries'
import { passwordSchema } from '@/lib/schemas'
import { changePassword, updatePhone } from '@/services/account.service'

function Field({ label, htmlFor, error, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-caption font-semibold">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function EditContactDialog({ open, onClose, onSaved }) {
  const twoFactor = !!useAuth().user?.twoFactor?.enabled
  const [country, setCountry] = useState(guessDefaultCountry)
  const [number, setNumber] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!isValidPhoneNumber(number, country)) next.phoneNumber = 'Enter a valid phone number'
    const codeError = confirmError(twoFactor, code)
    if (codeError) next.code = codeError
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const res = await updatePhone({ phoneCountry: country, phoneNumber: number, ...confirmPayload(twoFactor, code) })
      toast.success('Phone number updated')
      onSaved(res.phone)
    } catch (err) {
      setErrors({ phoneNumber: err.details?.phoneNumber, code: err.details?.code ?? err.details?.password ?? (err.details?.phoneNumber ? undefined : err.message) })
      setCode('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Edit contact information</DialogTitle>
            <DialogDescription>Your phone number can be used to sign in. Your name, email and identity details are verified and can only be changed by support.</DialogDescription>
          </DialogHeader>
          <Field label="New phone number" htmlFor="new-phone" error={errors.phoneNumber}>
            <PhoneInput
              id="new-phone"
              size="lg"
              placeholder="555 000 0000"
              country={country}
              onCountryChange={setCountry}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value)
                setErrors((x) => ({ ...x, phoneNumber: undefined }))
              }}
              invalid={!!errors.phoneNumber}
            />
          </Field>
          <ConfirmIdentity twoFactor={twoFactor} value={code} onChange={(v) => { setCode(v); setErrors((x) => ({ ...x, code: undefined })) }} error={errors.code} disabled={saving} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ChangePasswordDialog({ open, onClose, onChanged }) {
  const twoFactor = !!useAuth().user?.twoFactor?.enabled
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!form.currentPassword) next.currentPassword = 'Enter your current password'
    const pw = passwordSchema.safeParse(form.newPassword)
    if (!pw.success) next.newPassword = pw.error.issues[0].message
    if (form.newPassword !== form.confirmPassword) next.confirmPassword = 'Passwords do not match'
    if (twoFactor && !/^\d{6}$/.test(code)) next.code = 'Enter the 6-digit code'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const res = await changePassword({ ...form, ...(twoFactor ? { code } : {}) })
      toast.success('Password changed. Other devices were signed out.')
      onChanged(res.passwordChangedAt)
    } catch (err) {
      setErrors({ currentPassword: err.details?.currentPassword, newPassword: err.details?.newPassword, code: err.details?.code ?? (Object.keys(err.details ?? {}).length ? undefined : err.message) })
      setCode('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Change password</DialogTitle>
            <DialogDescription>You’ll stay signed in here; every other device is signed out.</DialogDescription>
          </DialogHeader>
          <Field label="Current password" htmlFor="current-password" error={errors.currentPassword}>
            <PasswordInput id="current-password" size="lg" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} aria-invalid={!!errors.currentPassword} />
          </Field>
          <Field label="New password" htmlFor="account-new-password" error={errors.newPassword}>
            <PasswordInput id="account-new-password" size="lg" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} aria-invalid={!!errors.newPassword} />
          </Field>
          <PasswordRequirements value={form.newPassword} />
          <Field label="Confirm new password" htmlFor="account-confirm-password" error={errors.confirmPassword}>
            <PasswordInput id="account-confirm-password" size="lg" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} aria-invalid={!!errors.confirmPassword} />
          </Field>
          {twoFactor && <ConfirmIdentity twoFactor value={code} onChange={(v) => { setCode(v); setErrors((x) => ({ ...x, code: undefined })) }} error={errors.code} disabled={saving} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
