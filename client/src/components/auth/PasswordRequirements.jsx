import { CheckIcon } from 'lucide-react'
import { PASSWORD_RULES } from '@/lib/schemas'
import { cn } from '@/lib/utils'

export default function PasswordRequirements({ value = '' }) {
  return (
    <div className="rounded-lg bg-muted px-[16.25px] py-[13.75px]">
      <p className="text-title font-semibold">Password requirements</p>
      <ul className="mt-2.5 grid gap-x-[15px] gap-y-[7.5px] sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value)
          return (
            <li
              key={rule.id}
              className={cn('flex items-center gap-[6.25px] text-caption transition-colors', met ? 'text-success' : 'text-subtle')}
            >
              <CheckIcon className={cn('size-[15px]', !met && 'text-border')} aria-hidden />
              {rule.label}
              <span className="sr-only">{met ? '(met)' : '(not met)'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
