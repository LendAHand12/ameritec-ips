import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STEPS } from './constants'

export default function Stepper({ current }) {
  return (
    <div>
      <ol className="grid grid-cols-5" aria-label="Registration progress">
        {STEPS.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li
              key={step.id}
              className="relative flex flex-col items-center gap-[8.75px]"
              aria-current={active ? 'step' : undefined}
            >
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-4 left-[calc(50%+24px)] h-[1.25px] w-[calc(100%-48px)] bg-border transition-colors',
                    done && 'bg-success',
                  )}
                />
              )}
              <span
                className={cn(
                  'relative flex size-[33.75px] items-center justify-center rounded-full border text-caption transition-all',
                  active && 'border-primary bg-primary font-bold text-primary-foreground shadow-step',
                  done && 'border-success bg-success text-white',
                  !active && !done && 'border-border bg-muted font-semibold text-muted-foreground',
                )}
              >
                {done ? <CheckIcon className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-center text-caption sm:block',
                  active ? 'font-bold text-foreground' : done ? 'font-semibold text-success' : 'font-semibold text-subtle',
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-center text-caption text-muted-foreground sm:hidden">
        Step {current + 1} of {STEPS.length} · <span className="font-semibold text-foreground">{STEPS[current].label}</span>
      </p>
    </div>
  )
}
