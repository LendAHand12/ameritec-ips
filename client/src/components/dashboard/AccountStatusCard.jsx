import { Link } from 'react-router-dom'
import { ShieldCheckIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Panel } from './Panel'
import StatusBadge from './StatusBadge'

/** Security checks derived from the real user record. */
export function securityChecks(user) {
  return [
    { label: 'Identity Verification', ok: user.status === 'approved', okText: 'Verified', badText: 'Pending' },
    { label: 'Two-factor authentication', ok: !!user.twoFactor?.enabled, okText: 'Enabled', badText: 'Disabled' },
    { label: 'Email verification', ok: !!user.emailVerified, okText: 'Verified', badText: 'Pending' },
    { label: 'Face ID', ok: !!user.faceVerified, okText: 'Enrolled', badText: 'Not set up' },
  ]
}

export function scoreLabel(ratio) {
  if (ratio >= 1) return { text: 'Excellent', tone: 'text-success', bar: 'bg-success' }
  if (ratio >= 0.75) return { text: 'Good', tone: 'text-success', bar: 'bg-success' }
  if (ratio >= 0.5) return { text: 'Fair', tone: 'text-warning', bar: 'bg-warning' }
  return { text: 'Weak', tone: 'text-danger', bar: 'bg-danger' }
}

export default function AccountStatusCard({ user }) {
  const checks = securityChecks(user)
  const ratio = checks.filter((c) => c.ok).length / checks.length
  const score = scoreLabel(ratio)
  const rows = [
    checks[0],
    checks[1],
    { label: 'Account Status', ok: user.accountStatus !== 'locked', okText: 'Active', badText: 'Locked' },
  ]

  return (
    <Panel className="flex flex-col">
      <div className="flex items-center gap-[13.75px] border-b border-divider pb-[21.25px]">
        <span className="flex size-[47.5px] items-center justify-center rounded-lg bg-success-soft text-success">
          <ShieldCheckIcon className="size-[25px]" />
        </span>
        <div>
          <h2 className="text-subheading font-bold">Account status</h2>
          <p className="pt-[6.25px] text-caption text-muted-foreground">
            {ratio >= 0.75 ? 'Your account is secure' : 'Finish setting up your security'}
          </p>
        </div>
      </div>

      <dl className="py-[11.25px]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-[12.5px]">
            <dt className="text-caption text-muted-foreground">{row.label}</dt>
            <dd>
              <StatusBadge tone={row.ok ? 'success' : 'warning'} icon={row.ok} className="font-bold">
                {row.ok ? row.okText : row.badText}
              </StatusBadge>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto pb-[15px]">
        <div className="rounded-lg bg-muted p-[13.75px]">
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted-foreground">Security score</span>
            <span className={`font-semibold ${score.tone}`}>{score.text}</span>
          </div>
          <div
            className="mt-[11.25px] h-[5px] overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-label="Security score"
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={`h-full rounded-full ${score.bar}`} style={{ width: `${ratio * 100}%` }} />
          </div>
        </div>
      </div>

      <Link to="/account" className={buttonVariants({ variant: 'outline', className: 'h-[50px] w-full bg-card text-title font-bold' })}>
        Manage security
      </Link>
    </Panel>
  )
}
