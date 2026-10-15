import { Link, useLocation } from 'react-router-dom'
import { BellIcon, CheckIcon, ShieldCheckIcon, ShieldXIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const VARIANTS = {
  pending: {
    icon: ShieldCheckIcon,
    iconBg: 'bg-warning',
    badge: { tone: 'warning', label: 'Pending Review' },
    title: 'Application under review',
    description: 'Your identity verification is being reviewed.',
    steps: [
      { label: 'Application submitted', state: 'done' },
      { label: 'Identity review in progress', state: 'current' },
      { label: 'Decision notification', state: 'upcoming' },
    ],
    note: 'You will be notified when your verification status changes.',
  },
  rejected: {
    icon: ShieldXIcon,
    iconBg: 'bg-danger',
    badge: { tone: 'danger', label: 'Rejected' },
    title: 'Application not approved',
    description: 'Unfortunately we couldn’t verify your identity.',
    steps: [
      { label: 'Application submitted', state: 'done' },
      { label: 'Identity review completed', state: 'done' },
      { label: 'Application not approved', state: 'failed' },
    ],
    note: 'Contact support if you believe this is a mistake.',
  },
}

const DOT = {
  done: 'bg-success shadow-[0_0_0_1.25px_var(--success)] text-white',
  current: 'bg-warning shadow-[0_0_0_1.25px_var(--warning)]',
  failed: 'bg-danger shadow-[0_0_0_1.25px_var(--danger)]',
  upcoming: 'bg-border shadow-[0_0_0_1.25px_var(--border)]',
}

function Timeline({ steps }) {
  return (
    <ol className="relative grid grid-cols-3 px-[12.5px]">
      {steps.map((step, i) => (
        <li key={step.label} className="relative flex flex-col items-center gap-[8.75px] text-center" aria-current={step.state === 'current' ? 'step' : undefined}>
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cn('absolute top-[10px] left-[calc(50%+16px)] h-[1.25px] w-[calc(100%-32px)] bg-border', step.state === 'done' && 'bg-success')}
            />
          )}
          <span className={cn('flex size-[21.25px] items-center justify-center rounded-full border-3 border-card', DOT[step.state])}>
            {step.state === 'done' && <CheckIcon className="size-[15px]" strokeWidth={3} />}
          </span>
          <span className={cn('text-caption text-muted-foreground', step.state === 'current' && 'font-bold')}>{step.label}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Shown to applicants who can't sign in yet (pending review or rejected).
 * Details come from the login / verify-email response via router state; a direct visit shows the generic view.
 */
export default function ApplicationStatusPage() {
  const { state } = useLocation()
  const variant = VARIANTS[state?.status === 'rejected' ? 'rejected' : 'pending']
  const Icon = variant.icon

  return (
    <div className="flex w-full max-w-[775px] flex-1 flex-col">
      <section className="w-full rounded-xl border bg-card p-5 shadow-card sm:p-[35px]">
        <div className="flex flex-col items-center text-center">
          <span className={cn('flex size-[70px] items-center justify-center rounded-full text-white', variant.iconBg)}>
            <Icon className="size-[35px]" />
          </span>
          <StatusBadge tone={variant.badge.tone} icon={false} className="mt-[17.5px]">
            {variant.badge.label}
          </StatusBadge>
          <h1 className="mt-[12.5px] text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">{variant.title}</h1>
          <p className="mt-[8.75px] text-caption text-muted-foreground">{variant.description}</p>
        </div>

        {(state?.applicationId || state?.reason) && (
          <dl className="mt-[27.5px] space-y-[6.25px] rounded-lg bg-muted p-[15px] text-caption">
            {state.applicationId && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-muted-foreground">Application ID</dt>
                <dd className="font-bold">{state.applicationId}</dd>
              </div>
            )}
            {state.submittedAt && <p className="text-subtle">Submitted {formatDate(state.submittedAt)}</p>}
            {state.reason && (
              <p className="pt-1 text-foreground">
                <span className="font-semibold">Reason:</span> {state.reason}
              </p>
            )}
          </dl>
        )}

        <div className="pt-[31.25px]">
          <Timeline steps={variant.steps} />
        </div>

        <p className="flex items-center justify-center gap-[8.75px] pt-[25px] text-center text-caption text-muted-foreground">
          <BellIcon className="size-[25px] shrink-0 text-primary" aria-hidden />
          {variant.note}
        </p>

        <Link
          to="/login"
          className={buttonVariants({ variant: 'outline', className: 'mt-[22.5px] h-[50px] w-full bg-card text-title font-bold' })}
        >
          Go to Sign In
        </Link>
      </section>
    </div>
  )
}
