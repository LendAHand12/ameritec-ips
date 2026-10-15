import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONES = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-primary-soft text-primary',
  violet: 'bg-violet-soft text-violet',
}

export default function StatusBadge({ tone = 'neutral', icon = tone === 'success', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex h-[29.375px] items-center gap-[5px] rounded-full px-2.5 text-caption font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon && <CheckIcon className="size-[16.25px]" aria-hidden />}
      {children}
    </span>
  )
}
