import { Input } from '@/components/ui/input'
import { normalizeEmail } from '@/lib/normalize'

/** Email input that blocks whitespace while typing and lower-cases/trims on blur. Works with react-hook-form's register(). */
export default function EmailInput({ onChange, onBlur, ...props }) {
  const handleChange = (e) => {
    const stripped = e.target.value.replace(/\s/g, '')
    if (stripped !== e.target.value) e.target.value = stripped
    onChange?.(e)
  }

  const handleBlur = (e) => {
    const normalized = normalizeEmail(e.target.value)
    if (normalized !== e.target.value) {
      e.target.value = normalized
      onChange?.(e)
    }
    onBlur?.(e)
  }

  return (
    <Input
      type="email"
      inputMode="email"
      autoComplete="email"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  )
}
