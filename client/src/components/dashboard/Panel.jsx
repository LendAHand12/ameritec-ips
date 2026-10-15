import { cn } from '@/lib/utils'

/** White card used across the investor portal. */
export function Panel({ className, ...props }) {
  return <section className={cn('rounded-xl border bg-card p-[25px] shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]', className)} {...props} />
}

export function PanelHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div>
        <h2 className="text-subheading font-bold">{title}</h2>
        {description && <p className="pt-[6.25px] text-caption text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
