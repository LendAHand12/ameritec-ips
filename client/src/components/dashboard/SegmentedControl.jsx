import { cn } from '@/lib/utils'

/**
 * Pill segmented control.
 * variant "card": muted track, active = white raised chip (filters)
 * variant "solid": no track, active = brand muted red (time ranges)
 */
export default function SegmentedControl({ options, value, onChange, label, variant = 'card', className }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-lg', variant === 'card' && 'border border-divider bg-muted p-[3.75px]', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex h-[35px] items-center rounded-[7.5px] px-[15px] text-caption font-semibold whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30',
              active && variant === 'card' && 'bg-card text-foreground shadow-[0_1.25px_1.875px_rgb(0_0_0/0.1)]',
              active && variant === 'solid' && 'bg-brand-muted text-white shadow-[0_1.25px_1.875px_rgb(0_0_0/0.1)] hover:text-white',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
