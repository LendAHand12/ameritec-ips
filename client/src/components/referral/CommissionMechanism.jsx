import { Link } from 'react-router-dom'
import { ArrowRightIcon, InfoIcon } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import { cn } from '@/lib/utils'

const NODES = [
  { label: 'You', root: true },
  { label: 'F1', earns: true },
  { label: 'F2' },
  { label: 'F3' },
]

export default function CommissionMechanism({ ratePct }) {
  const sameRate = ratePct.A === ratePct.B
  return (
    <Panel className="flex flex-col">
      <PanelHeader title="How commissions work" description="Commission is paid on your direct referrals’ purchases." />

      <ol className="flex items-start justify-center gap-1.5 pt-6" aria-label="Referral levels">
        {NODES.map((n, i) => (
          <li key={n.label} className="flex items-start gap-1.5">
            {i > 0 && <ArrowRightIcon className="mt-2.5 size-3.5 text-subtle" aria-hidden />}
            <span className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border text-caption font-bold',
                  n.root && 'border-brand-muted bg-brand-muted text-white',
                  n.earns && 'border-primary bg-primary-soft text-primary',
                  !n.root && !n.earns && 'bg-muted text-muted-foreground',
                )}
              >
                {n.label}
              </span>
              <span className={cn('text-caption', n.earns ? 'font-bold text-primary' : 'text-subtle')}>
                {n.root ? '' : n.earns ? (sameRate ? `${ratePct.A}%` : `${ratePct.A}% / ${ratePct.B}%`) : 'Network'}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-warning-soft p-3 text-caption text-[#75521d]">
        <InfoIcon className="mt-px size-4 shrink-0 text-warning" />
        <p>
          You earn{' '}
          {sameRate ? (
            <b>{ratePct.A}%</b>
          ) : (
            <>
              <b>{ratePct.A}%</b> on Class A and <b>{ratePct.B}%</b> on Class B
            </>
          )}{' '}
          of every completed purchase made by your direct referrals (F1), credited straight to your commission balance. F2 and F3 are shown so you can follow your network’s growth. Rates are subject to the current Ameritec Pre-IPO program
          rules.
        </p>
      </div>

      <Link to="/guide" className="mt-auto flex items-center gap-3 pt-6 text-title font-bold text-primary hover:underline">
        Learn more
        <ArrowRightIcon className="size-[22.5px]" />
      </Link>
    </Panel>
  )
}
