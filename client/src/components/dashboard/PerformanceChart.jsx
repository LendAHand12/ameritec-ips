import { useId, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { useCssVars } from '@/hooks/useCssVar'
import { formatCompact, formatPercent, formatShortDate, formatUsdt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Panel, PanelHeader } from './Panel'
import SegmentedControl from './SegmentedControl'

const SHARE_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'A', label: 'Class A' },
  { value: 'B', label: 'Class B' },
]
const RANGE_OPTIONS = ['7D', '30D', '3M', '1Y', 'ALL'].map((r) => ({ value: r, label: r === 'ALL' ? 'All' : r }))
const SERIES_VAR = { ALL: '--share-a', A: '--share-a', B: '--share-b' }
const RANGE_DAYS = { '7D': 7, '30D': 30, '3M': 90, '1Y': 365 }
const DAY = 24 * 60 * 60 * 1000
const MAX_POINTS = 120

/**
 * Portfolio value over time = shares held on each day × the current price of each share type.
 * (There is no historical price feed yet, so the line moves when holdings change.)
 */
function buildSeries(portfolio, share, range) {
  const price = Object.fromEntries(portfolio.shares.map((s) => [s.type, s.price]))
  const events = portfolio.history
    .filter((h) => share === 'ALL' || h.shareType === share)
    .map((h) => ({ t: new Date(h.date).getTime(), value: h.shares * price[h.shareType] }))
  if (!events.length) return []

  const end = Date.now()
  const firstPurchase = Math.min(...events.map((e) => e.t))
  const start = range === 'ALL' ? Math.min(firstPurchase, end - 7 * DAY) : end - RANGE_DAYS[range] * DAY
  const step = Math.max(DAY, (end - start) / MAX_POINTS)

  const points = []
  for (let t = start; t <= end; t += step) {
    points.push({ date: new Date(t).toISOString(), value: events.filter((e) => e.t <= t).reduce((sum, e) => sum + e.value, 0) })
  }
  points.push({ date: new Date(end).toISOString(), value: events.reduce((sum, e) => sum + e.value, 0) })
  return points
}

function ChartTooltip({ active, payload, color }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-caption text-muted-foreground">{formatShortDate(point.date)}</p>
      <p className="flex items-center gap-2 text-sm font-bold tabular-nums">
        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: color }} />
        {formatUsdt(point.value)} <span className="text-caption font-semibold text-muted-foreground">USDT</span>
      </p>
    </div>
  )
}

/** Hollow marker on the latest point, as in the design. */
function LastPointDot({ cx, cy, index, points, color, surface }) {
  if (index !== points.length - 1) return null
  return <circle cx={cx} cy={cy} r={5} fill={surface} stroke={color} strokeWidth={2.5} />
}

export default function PerformanceChart({ portfolio }) {
  const [share, setShare] = useState('ALL')
  const [range, setRange] = useState('30D')
  const gradientId = useId()
  const points = useMemo(() => buildSeries(portfolio, share, range), [portfolio, share, range])
  const colors = useCssVars([SERIES_VAR.ALL, SERIES_VAR.B, '--card', '--divider', '--subtle', '--muted-foreground'])
  const color = colors[SERIES_VAR[share]]

  const first = points?.[0]?.value ?? 0
  const last = points?.at(-1)?.value ?? 0
  const change = last - first
  const changePct = first ? (change / first) * 100 : null
  const up = change >= 0
  const TrendIcon = up ? TrendingUpIcon : TrendingDownIcon

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Portfolio performance"
        description="Value of your holdings over time, at the current Pre-IPO price"
        action={<SegmentedControl label="Class" options={SHARE_OPTIONS} value={share} onChange={setShare} />}
      />

      <div className="flex flex-wrap items-end gap-x-[17.5px] gap-y-1 pt-[22.5px]">
        <div className="space-y-[5px]">
          <p className="text-caption text-muted-foreground">Current value</p>
          <p className="whitespace-nowrap">
            <span className="text-2xl font-bold tracking-[-0.02em] tabular-nums">{formatUsdt(last)}</span>{' '}
            <span className="text-caption font-bold text-muted-foreground">USDT</span>
          </p>
        </div>
        <p className="flex items-center gap-[5px] pb-[3.75px] text-caption">
          <TrendIcon className={cn('size-5', up ? 'text-success' : 'text-danger')} aria-hidden />
          {changePct !== null && <span className={cn('font-semibold', up ? 'text-success' : 'text-danger')}>{formatPercent(changePct)}</span>}
          <span className="text-muted-foreground">
            ({up ? '+' : '−'}
            {formatUsdt(Math.abs(change))} USDT)
          </span>
        </p>
      </div>

      <figure
        className="mt-2 h-[246px] min-w-0"
        aria-label={`Portfolio value ${range === 'ALL' ? 'all time' : `over ${range}`}: from ${formatUsdt(first)} to ${formatUsdt(last)} USDT`}
        role="img"
      >
        {!points.length && (
          <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-caption text-muted-foreground">
            <p className="font-semibold text-foreground">No holdings yet</p>
            <p>Your portfolio value will appear here after your first completed purchase.</p>
          </div>
        )}
        {points.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={colors['--divider']} strokeDasharray="2.5 5" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fill: colors['--subtle'], fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickMargin={10}
              />
              <YAxis
                tickFormatter={formatCompact}
                tick={{ fill: colors['--subtle'], fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickCount={4}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={<ChartTooltip color={color} />}
                cursor={{ stroke: colors['--muted-foreground'], strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area
                // Holdings change in steps (a purchase), so draw steps rather than a smoothed curve
                type="stepAfter"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={({ key, ...props }) => <LastPointDot key={key} {...props} points={points} color={color} surface={colors['--card']} />}
                activeDot={{ r: 5, fill: colors['--card'], stroke: color, strokeWidth: 2.5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </figure>

      <div className="mt-[15px] flex justify-end border-t border-divider pt-[15px]">
        <SegmentedControl label="Time range" variant="solid" options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>
    </Panel>
  )
}
