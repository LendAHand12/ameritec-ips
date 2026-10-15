import { cn } from '@/lib/utils'

export default function KpiCard({ label, value, unit, icon, footer, highlight = false }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-card px-[25px] pt-[23.75px] pb-[21.25px] shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]',
        highlight && 'border-t-4 border-t-primary pt-[21.25px]',
      )}
    >
      <div className="flex min-h-[37.5px] items-center justify-between gap-3">
        <p className="text-title font-semibold text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="pt-[16.25px] whitespace-nowrap">
        <span className="text-heading font-bold tabular-nums">{value}</span>{' '}
        <span className="text-caption font-semibold text-muted-foreground">{unit}</span>
      </p>
      <div className="flex min-h-[18.75px] items-center gap-[5px] pt-[8.75px] text-caption text-muted-foreground">{footer}</div>
    </div>
  )
}

export function KpiIcon({ icon }) {
  const Icon = icon
  return (
    <span className="flex size-[37.5px] items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
      <Icon className="size-[25px]" />
    </span>
  )
}
