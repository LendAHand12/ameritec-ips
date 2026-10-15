import { useState } from 'react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

export default function PasswordInput({ size, className, ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <InputGroup size={size} className={className}>
      <InputGroupInput type={visible ? 'text' : 'password'} {...props} />
      <InputGroupAddon align="inline-end" className="pr-0">
        <button
          type="button"
          className="h-full rounded-r-lg px-[13.75px] text-caption font-semibold text-primary outline-none hover:underline focus-visible:underline"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </InputGroupAddon>
    </InputGroup>
  )
}
