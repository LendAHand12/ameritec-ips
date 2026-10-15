import { useState } from 'react'
import { formatDuration, formatInt, formatShortDate } from '@/lib/format'
import { SUPPORT_CATEGORIES } from '@/lib/support'

function Tile({ title, children, className = '' }) {
  return (
    <div className={`flex min-h-[129px] flex-col justify-between gap-3 rounded-lg border border-divider p-[12.5px] ${className}`}>
      <p className="text-title font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

/** One thin bar per issue type; hover (or focus) shows the count. */
function CategoryBars({ byCategory }) {
  const [active, setActive] = useState(null)
  const max = Math.max(1, ...Object.values(byCategory))
  const current = SUPPORT_CATEGORIES.find((c) => c.value === active)
  return (
    <div>
      <p className="h-[18px] text-caption text-muted-foreground" aria-live="polite">
        {current ? `${current.label}: ${formatInt(byCategory[current.value])}` : 'Hover a bar for details'}
      </p>
      <ul className="mt-1.5 flex h-[50px] items-end gap-2.5" aria-label="Tickets by issue type">
        {SUPPORT_CATEGORIES.map((c) => {
          const n = byCategory[c.value] ?? 0
          return (
            <li key={c.value} className="flex h-full items-end">
              <button
                type="button"
                aria-label={`${c.label}: ${n}`}
                onMouseEnter={() => setActive(c.value)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(c.value)}
                onBlur={() => setActive(null)}
                className="flex h-full w-[23px] items-end justify-center outline-none"
              >
                <span
                  className="block w-[15px] rounded-t-[4px] bg-primary transition-opacity"
                  style={{ height: `${Math.max(n ? 6 : 2, (n / max) * 50)}px`, opacity: active && active !== c.value ? 0.4 : 1 }}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Ring showing the open share of all tickets. */
function OpenRing({ open, total }) {
  const r = 22
  const c = 2 * Math.PI * r
  const share = total ? open / total : 0
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 60 60" className="size-[60px] -rotate-90" aria-hidden>
        <circle cx="30" cy="30" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle cx="30" cy="30" r={r} fill="none" strokeWidth="10" strokeDasharray={`${share * c} ${c}`} className="stroke-primary" />
      </svg>
      <div className="space-y-[3.75px]">
        <p className="text-heading font-bold tabular-nums">{formatInt(open)}</p>
        <p className="text-caption text-muted-foreground">Open · {formatInt(total)} total</p>
      </div>
    </div>
  )
}

/** Tickets created per day, with a crosshair tooltip. */
function VolumeLine({ volume }) {
  const [hover, setHover] = useState(null)
  const W = 340
  const H = 64
  const max = Math.max(1, ...volume.map((d) => d.count))
  const x = (i) => (i / Math.max(1, volume.length - 1)) * W
  const y = (n) => H - 3 - (n / max) * (H - 6)
  const points = volume.map((d, i) => `${x(i)},${y(d.count)}`).join(' ')
  const total = volume.reduce((s, d) => s + d.count, 0)
  const point = hover != null ? volume[hover] : null

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (volume.length - 1))
    setHover(Math.min(volume.length - 1, Math.max(0, i)))
  }

  return (
    <div>
      <p className="h-[18px] text-caption text-muted-foreground" aria-live="polite">
        {point
          ? `${formatShortDate(`${point.date}T12:00:00`)}: ${formatInt(point.count)} tickets`
          : `${formatInt(total)} tickets in ${volume.length} days`}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-1.5 h-[64px] w-full overflow-visible"
        role="img"
        aria-label={`Ticket volume, last ${volume.length} days: ${formatInt(total)} tickets`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-divider" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polyline points={points} fill="none" strokeWidth="2" strokeLinejoin="round" className="stroke-primary" vectorEffect="non-scaling-stroke" />
        {point && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} className="stroke-subtle" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(point.count)} r="4" className="fill-primary stroke-card" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
    </div>
  )
}

export default function SupportAnalytics({ stats }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
      <div className="border-b border-divider pb-[16.25px]">
        <h2 className="text-subheading font-semibold">Support Analytics</h2>
        <p className="pt-[5px] text-caption text-muted-foreground">
          Ticket volume and response times. Averages cover the last {stats?.metricsDays ?? 30} days.
        </p>
      </div>
      <div className="grid gap-2.5 pt-[15px] sm:grid-cols-2 xl:grid-cols-4">
        <Tile title="Tickets by Issue Type">{stats && <CategoryBars byCategory={stats.byCategory} />}</Tile>
        <Tile title="Tickets by Status">
          {stats && <OpenRing open={stats.open} total={Object.values(stats.byStatus).reduce((a, b) => a + b, 0)} />}
        </Tile>
        <Tile title="Ticket Volume Over Time">{stats && <VolumeLine volume={stats.volume} />}</Tile>
        <Tile title="Average First Response">
          <p className="text-heading font-bold tabular-nums">{formatDuration(stats?.avgFirstResponseMs)}</p>
          <p className="text-subheading text-muted-foreground">Average Resolution · {formatDuration(stats?.avgResolutionMs)}</p>
        </Tile>
      </div>
    </section>
  )
}
