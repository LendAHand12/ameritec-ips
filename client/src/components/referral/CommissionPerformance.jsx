import { useId, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import SegmentedControl from '@/components/dashboard/SegmentedControl'
import { useAsync } from '@/hooks/useAsync'
import { useCssVars } from '@/hooks/useCssVar'
import { formatCompact, formatPercent, formatShortDate, formatUsdt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getCommissionChart } from '@/services/referral.service'

const RANGE_OPTIONS = ['7D', '30D', '3M', '1Y', 'ALL'].map((r) => ({ value: r, label: r === 'ALL' ? 'All' : r }))

function ChartTooltip({ active, payload, color }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="text-caption text-muted-foreground">{formatShortDate(p.date)}</p>
      <p className="flex items-center gap-2 text-sm font-bold tabular-nums">
        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: color }} />
        {formatUsdt(p.cumulative)} <span className="text-caption font-semibold text-muted-foreground">USDT earned</span>
      </p>
      {p.amount > 0 && <p className="text-caption text-success">+{formatUsdt(p.amount)} that day</p>}
    </div>
  )
}

/** Cumulative commission earned over the selected period. */
export default function CommissionPerformance() {
  const [range, setRange] = useState('30D')
  const gradientId = useId()
  const { data, loading } = useAsync(() => getCommissionChart(range), [range])
  const colors = useCssVars(['--primary', '--card', '--divider', '--subtle', '--muted-foreground'])
  const color = colors['--primary']

  const points = useMemo(() => {
    let sum = 0
    return (data?.points ?? []).map((p) => ({ ...p, cumulative: (sum += p.amount) }))
  }, [data])
  const up = (data?.changePct ?? 0) >= 0
  const TrendIcon = up ? TrendingUpIcon : TrendingDownIcon

  return (
    <Panel className="flex flex-col">
      <PanelHeader title="Commission Performance" description="Commission earned over time" />
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1 pt-5">
        <div className="space-y-[5px]">
          <p className="text-caption text-muted-foreground">Total earned</p>
          <p>
            <span className="text-2xl font-bold tabular-nums">{formatUsdt(data?.total ?? 0)}</span>{' '}
            <span className="text-caption font-bold text-muted-foreground">USDT</span>
          </p>
        </div>
        {data?.changePct != null && (
          <p className="flex items-center gap-[5px] pb-1 text-caption">
            <TrendIcon className={cn('size-5', up ? 'text-success' : 'text-danger')} aria-hidden />
            <span className={cn('font-semibold', up ? 'text-success' : 'text-danger')}>{formatPercent(data.changePct)}</span>
            <span className="text-muted-foreground">vs. previous period</span>
          </p>
        )}
      </div>

      <figure
        className={cn('mt-2 h-[220px] min-w-0 transition-opacity', loading && data && 'opacity-50')}
        role="img"
        aria-label={`Commission earned ${range === 'ALL' ? 'all time' : `over ${range}`}: ${formatUsdt(data?.total ?? 0)} USDT`}
      >
        {data && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={colors['--divider']} strokeDasharray="2.5 5" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: colors['--subtle'], fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={40} tickMargin={10} />
              <YAxis tickFormatter={formatCompact} tick={{ fill: colors['--subtle'], fontSize: 12 }} tickLine={false} axisLine={false} width={40} tickCount={4} allowDecimals={false} />
              <Tooltip content={<ChartTooltip color={color} />} cursor={{ stroke: colors['--muted-foreground'], strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
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
