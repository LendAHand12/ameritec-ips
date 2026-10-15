import { useEffect, useRef } from 'react'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'

export default function OtpInput({ value, onChange, onComplete, disabled, invalid, autoFocus = true, ...props }) {
  const ref = useRef(null)

  // The input is disabled while a code is being checked, which drops focus — bring it back after a wrong code
  useEffect(() => {
    if (!disabled && invalid) ref.current?.focus()
  }, [disabled, invalid])

  return (
    <InputOTP
      ref={ref}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-invalid={invalid}
      {...props}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} aria-invalid={invalid} />
        <InputOTPSlot index={1} aria-invalid={invalid} />
        <InputOTPSlot index={2} aria-invalid={invalid} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} aria-invalid={invalid} />
        <InputOTPSlot index={4} aria-invalid={invalid} />
        <InputOTPSlot index={5} aria-invalid={invalid} />
      </InputOTPGroup>
    </InputOTP>
  )
}
