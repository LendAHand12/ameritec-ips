import { FieldError } from '@/components/ui/field'
import OtpInput from '@/components/auth/OtpInput'
import PasswordInput from '@/components/auth/PasswordInput'

/**
 * Re-authentication field for sensitive actions. With two-factor on: the authenticator code.
 * Otherwise (two-factor is optional): the account password.
 */
export default function ConfirmIdentity({ twoFactor, value, onChange, error, disabled }) {
  if (twoFactor) {
    return (
      <div className="space-y-2">
        <p className="text-caption font-semibold">Authenticator code</p>
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/60 py-4">
          <OtpInput value={value} onChange={onChange} disabled={disabled} invalid={!!error} autoFocus={false} />
          <p className="text-caption text-muted-foreground">6-digit code from your Google Authenticator app</p>
          <FieldError>{error}</FieldError>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor="confirm-password" className="text-caption font-semibold">
        Confirm with your password
      </label>
      <PasswordInput
        id="confirm-password"
        size="lg"
        autoComplete="current-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

/** Checks the value typed into <ConfirmIdentity>; returns an error message or ''. */
export const confirmError = (twoFactor, value) => (twoFactor ? (/^\d{6}$/.test(value) ? '' : 'Enter the 6-digit code') : value ? '' : 'Enter your password')

/** The request fields for that value: { code } or { password }. */
export const confirmPayload = (twoFactor, value) => (twoFactor ? { code: value } : { password: value })
