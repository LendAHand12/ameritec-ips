import { cn } from '@/lib/utils'

/** White card used by every auth screen: icon tile, heading, subtitle, then content. */
export default function AuthCard({ icon: Icon, title, description, className, children }) {
  return (
    <section className={cn('w-full rounded-xl border bg-card p-5 shadow-card sm:p-[35px]', className)}>
      <header className="flex flex-col items-center text-center">
        {Icon && (
          <span className="flex size-[50px] items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="size-[25px]" />
          </span>
        )}
        <h1 className="mt-[15px] text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">{title}</h1>
        {description && <div className="mt-[8.75px] text-caption text-muted-foreground">{description}</div>}
      </header>
      {children && <div className="pt-[28.75px]">{children}</div>}
    </section>
  )
}
