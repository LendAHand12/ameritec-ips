import { formatInt } from '@/lib/format'

const STATS = [
  { key: 'f1', label: 'Direct Referrals / F1', color: 'var(--primary)' },
  { key: 'f2', label: 'F2', color: 'var(--share-b)' },
  { key: 'f3', label: 'F3', color: 'var(--brand-muted)' },
  { key: 'total', label: 'Total Network', color: 'var(--success)' },
]

export default function NetworkOverview({ network }) {
  const values = { ...network.levels, total: network.total }
  return (
    <section className="grid gap-4 rounded-xl border bg-card px-[25px] py-[17.5px] shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)] sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] lg:items-center">
      <div>
        <h2 className="text-title font-bold">Network overview</h2>
        <p className="pt-1 text-caption text-muted-foreground">Members by referral level</p>
      </div>
      {STATS.map((s) => (
        <div key={s.key} className="flex items-center gap-3">
          <span aria-hidden className="h-10 w-1.5 rounded-full" style={{ background: s.color }} />
          <div>
            <p className="text-caption text-muted-foreground">{s.label}</p>
            <p>
              <span className="text-title font-bold tabular-nums">{formatInt(values[s.key])}</span>{' '}
              <span className="text-caption text-muted-foreground">Members</span>
            </p>
          </div>
        </div>
      ))}
    </section>
  )
}
