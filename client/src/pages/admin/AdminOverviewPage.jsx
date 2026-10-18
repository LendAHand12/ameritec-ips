import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import {
  ArrowRightIcon,
  ArrowRightLeftIcon,
  BanknoteIcon,
  CircleHelpIcon,
  ClockIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatDateTime24, formatDuration, formatInt, formatPercent, formatUsdt, formatShares } from '@/lib/format'
import { KYC_STATUS } from '@/lib/adminUsers'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { ORDER_STATUS } from '@/lib/orders'
import { cn } from '@/lib/utils'
import { getOrderStats, getOverview, getSupportStats, getUserStats, listAdminOrders, listUsers } from '@/services/admin.service'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
]


const card = 'rounded-[11.25px] border bg-card shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]'
const th = 'border-y border-divider bg-muted px-2.5 py-[11.25px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-2.5 py-[11.25px] whitespace-nowrap'

function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-title font-bold">{title}</h2>
        {subtitle && <p className="pt-[3.75px] text-caption text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function LinkAction({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-title font-semibold whitespace-nowrap text-primary hover:underline">
      {children}
      <ArrowRightIcon className="size-4" />
    </Link>
  )
}

function Kpi({ label, value, unit, note, noteTone = 'success', icon, tone = 'brand' }) {
  const Icon = icon
  const tones = { brand: 'bg-primary-soft text-primary', warning: 'bg-warning-soft text-warning' }
  const noteTones = { success: 'text-success', warning: 'text-warning', muted: 'text-muted-foreground' }
  return (
    <article className={cn(card, 'px-[17.5px] py-[15px]')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-caption font-semibold text-muted-foreground uppercase">{label}</p>
        <span className={cn('flex size-[30px] items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-[17px]" />
        </span>
      </div>
      <p className="pt-2.5 text-heading font-bold tabular-nums">
        {value ?? '—'}
        {unit && <span className="pl-1.5 text-caption font-medium text-muted-foreground">{unit}</span>}
      </p>
      {note && <p className={cn('pt-1.5 text-caption font-semibold', noteTones[noteTone])}>{note}</p>}
    </article>
  )
}

function MiniMetric({ label, value, icon }) {
  const Icon = icon
  return (
    <div className={cn(card, 'flex items-center gap-2.5 px-3 py-2.5')}>
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-caption text-muted-foreground">{label}</p>
        <p className="truncate text-caption font-bold tabular-nums">{value ?? '—'}</p>
      </div>
    </div>
  )
}

function StatRows({ rows }) {
  return (
    <ul className="pt-3">
      {rows.map(([label, value]) => (
        <li key={label} className="flex items-center justify-between border-b border-divider py-[9px] text-caption last:border-0">
          <span className="text-muted-foreground">
            <span className="pr-2 text-subtle">›</span>
            {label}
          </span>
          <span className="font-bold tabular-nums">{value ?? '—'}</span>
        </li>
      ))}
    </ul>
  )
}

const hourLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric' })
const dayLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
/** Bucket key ("2026-10-02" or "2026-10-02T14") → axis label. */
const bucketLabel = (key) => (key.includes('T') ? hourLabel.format(new Date(`${key}:00:00`)) : dayLabel.format(new Date(`${key}T12:00:00`)))
const isoDay = (d) => new Intl.DateTimeFormat('en-CA').format(d)

const chartTooltip = { contentStyle: { borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 } }

export default function AdminOverviewPage() {
  const { refreshStats } = useOutletContext()
  const { can } = useAdminAuth()
  const navigate = useNavigate()
  const [range, setRange] = useState('30')
  const [reloadKey, setReloadKey] = useState(0)
  const [custom, setCustom] = useState(() => ({ from: isoDay(new Date(Date.now() - 29 * 86_400_000)), to: isoDay(new Date()) }))
  const [updatedAt, setUpdatedAt] = useState(() => new Date())

  const overviewQuery = useMemo(() => (range === 'custom' ? { range, ...custom } : { range }), [range, custom])
  const customInvalid = range === 'custom' && !(custom.from && custom.to && custom.from <= custom.to)
  const { data: overview } = useAsync(
    () => (customInvalid ? Promise.resolve(null) : getOverview(overviewQuery).then((r) => r.data)),
    [overviewQuery, customInvalid, reloadKey],
  )
  // Each widget loads only if this admin may see its data; the rest show "—" or stay empty
  const skip = Promise.resolve(null)
  const { data: users } = useAsync(() => (can('users:view') ? getUserStats().then((r) => r.data) : skip), [reloadKey])
  const { data: orders } = useAsync(() => (can('orders:view') ? getOrderStats().then((r) => r.data) : skip), [reloadKey])
  const { data: support } = useAsync(() => (can('support:view') ? getSupportStats() : skip), [reloadKey])
  const { data: recentOrders } = useAsync(() => (can('orders:view') ? listAdminOrders({ page: 1, limit: 5 }).then((r) => r.data) : skip), [reloadKey])
  const { data: pendingKyc } = useAsync(() => (can('users:view') ? listUsers({ page: 1, limit: 4, kycStatus: 'pending' }).then((r) => r.data) : skip), [reloadKey])

  const refresh = () => {
    setReloadKey((k) => k + 1)
    setUpdatedAt(new Date())
    refreshStats()
  }

  const shares = overview?.shares
  const sold = shares?.sold
  const remaining = shares?.remaining
  const soldPct = shares?.total ? Math.round((shares.sold / shares.total) * 100) : 0
  const failedOrders = overview?.orders.failed
  const rangeLabel = RANGES.find((r) => r.value === range).label.toLowerCase()
  const growth = (overview?.growth ?? []).map((g) => ({ ...g, label: bucketLabel(g.key) }))
  const volumeSeries = (overview?.volume.series ?? []).map((v) => ({ ...v, label: bucketLabel(v.key) }))
  const changePct = overview?.volume.changePct
  const alerts = [
    orders?.pendingReview > 0 && { icon: ArrowRightLeftIcon, text: `${orders.pendingReview} transactions are pending review`, to: '/admin/transactions' },
    users?.pending > 0 && { icon: ShieldCheckIcon, text: `${users.pending} KYC applications are awaiting review`, to: '/admin/users' },
    support?.needsAttention > 0 && { icon: CircleHelpIcon, text: `${support.needsAttention} support requests require attention`, to: '/admin/support' },
    shares && soldPct >= 50 && { icon: TriangleAlertIcon, text: `Share allocation has reached ${soldPct}%`, to: '/admin/shares' },
  ].filter(Boolean)

  const quickActions = [
    ['Review KYC', '/admin/users', 'users:view'],
    ['View Pending Transactions', '/admin/transactions?status=pending_review', 'orders:view'],
    ['Manage Operational Parameters', '/admin/parameters', 'parameters:view'],
    ['Open Support Inbox', '/admin/support', 'support:view'],
  ].filter(([, , permission]) => can(permission))

  return (
    <div className="space-y-[12.5px]">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Overview</h1>
          <p className="pt-[6.25px] text-title text-muted-foreground">Monitor Ameritec IPS Pre-IPO operations and platform activity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-caption">
            <p className="text-muted-foreground">Last updated</p>
            <p className="font-bold">{formatDateTime24(updatedAt)}</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-[37.5px] items-center gap-2 rounded-lg border bg-card px-[11px] text-title font-semibold hover:bg-muted"
          >
            <RefreshCwIcon className="size-[17px]" />
            Refresh
          </button>
          <div role="tablist" aria-label="Date range" className="flex rounded-lg border bg-card p-[4.75px]">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="tab"
                aria-selected={range === r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  'h-[35px] rounded-md px-[15px] text-title font-semibold transition-colors',
                  range === r.value ? 'bg-muted text-foreground shadow-[0_1px_1px_rgb(0_0_0/0.06)]' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-2 text-caption">
              {['from', 'to'].map((key) => (
                <input
                  key={key}
                  type="date"
                  aria-label={key === 'from' ? 'From date' : 'To date'}
                  value={custom[key]}
                  max={isoDay(new Date())}
                  onChange={(e) => setCustom((c) => ({ ...c, [key]: e.target.value }))}
                  className="h-[37.5px] rounded-lg border bg-card px-2.5 text-caption"
                />
              ))}
            </div>
          )}
          {customInvalid && <p className="w-full text-right text-caption text-danger">Choose a valid date range.</p>}
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-[12.5px] sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total Users" value={users && formatInt(users.total)} unit="Users" note={overview && `+${formatInt(overview.users.newInPeriod)} ${range === 'today' ? 'today' : 'in this period'}`} icon={UsersIcon} />
        <Kpi label="USDT Transaction Volume" value={overview && formatUsdt(overview.volume.total)} unit="USDT" note={changePct != null ? `${formatPercent(changePct)} vs previous period` : 'No previous period to compare'} noteTone={changePct != null && changePct < 0 ? 'warning' : changePct != null ? 'success' : 'muted'} icon={BanknoteIcon} />
        <Kpi label="Shares Sold" value={shares && formatShares(sold)} unit="Shares" note={shares && `${soldPct}% of current allocation`} noteTone="muted" icon={TrendingUpIcon} />
        <Kpi
          label="Support Requests Pending"
          value={support && formatInt(support.needsAttention)}
          unit="Requests"
          note={support?.needsAttention > 0 ? `${support.needsAttention} require attention` : 'All caught up'}
          noteTone={support?.needsAttention > 0 ? 'warning' : 'success'}
          icon={CircleHelpIcon}
          tone="warning"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-[12.5px] md:grid-cols-3 xl:grid-cols-6">
        <MiniMetric label="New Users" value={overview && formatInt(overview.users.newInPeriod)} icon={UsersIcon} />
        <MiniMetric label="KYC Pending" value={users && formatInt(users.pending)} icon={ClockIcon} />
        <MiniMetric label="KYC Approved" value={users && formatInt(users.approved)} icon={ShieldCheckIcon} />
        <MiniMetric label="Transactions Pending" value={orders && formatInt(orders.pendingReview)} icon={ArrowRightLeftIcon} />
        <MiniMetric label="Failed Transactions" value={overview && formatInt(failedOrders)} icon={XCircleIcon} />
        <MiniMetric label="Remaining Share Allocation" value={shares && `${formatShares(remaining)} Shares`} icon={TrendingUpIcon} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-[12.5px] lg:grid-cols-2">
        <section className={cn(card, 'p-[18.75px]')}>
          <CardHeader
            title="User Growth"
            subtitle={`New and total registered users · ${rangeLabel}`}
            action={
              <div className="flex gap-3 text-caption text-muted-foreground">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary" />New Users</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-brand-muted" />Total Users</span>
              </div>
            }
          />
          <div className="flex gap-8 pt-4 text-caption text-muted-foreground">
            <div><p>New Users</p><p className="text-subheading font-bold text-foreground tabular-nums">{overview ? formatInt(overview.users.newInPeriod) : '—'}</p></div>
            <div><p>Total Users</p><p className="text-subheading font-bold text-foreground tabular-nums">{overview ? formatInt(overview.users.total) : '—'}</p></div>
          </div>
          <div className="h-[150px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--divider)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--subtle)' }} minTickGap={24} />
                <Tooltip {...chartTooltip} />
                <Line type="monotone" dataKey="newUsers" name="New Users" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="totalUsers" name="Total Users" stroke="var(--brand-muted)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cn(card, 'p-[18.75px]')}>
          <CardHeader
            title="USDT Transaction Volume"
            subtitle={`Completed purchase volume · ${rangeLabel}`}
            action={
              changePct != null && (
                <span className={cn('rounded-full px-2.5 py-1 text-caption font-semibold', changePct >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
                  {changePct >= 0 ? '↗' : '↘'} {Math.abs(changePct).toFixed(1)}%
                </span>
              )
            }
          />
          <div className="flex gap-8 pt-4 text-caption text-muted-foreground">
            <div><p>Total Volume</p><p className="text-subheading font-bold text-foreground tabular-nums">{overview ? formatUsdt(overview.volume.total) : '—'} <span className="text-caption font-medium text-muted-foreground">USDT</span></p></div>
            <div><p>Previous period</p><p className="text-subheading font-bold text-foreground tabular-nums">{overview ? formatUsdt(overview.volume.previous) : '—'}</p></div>
          </div>
          <div className="h-[150px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeSeries} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--subtle)' }} minTickGap={24} />
                <Tooltip {...chartTooltip} formatter={(v) => [`${formatUsdt(v)} USDT`, 'Volume']} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="volume" fill="var(--primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Allocation, KYC, transactions */}
      <div className="grid grid-cols-1 gap-[12.5px] lg:grid-cols-3">
        <section className={cn(card, 'p-[18.75px]')}>
          <CardHeader title="Shares Sold" subtitle="Current allocation utilization" action={<span className="text-title font-bold text-primary">{soldPct}%</span>} />
          <div className="py-6 text-center">
            <p className="text-subheading font-bold tabular-nums">{shares ? `${(sold / 1_000_000).toFixed(2)}M` : '—'}</p>
            <p className="text-caption text-muted-foreground">Total Sold</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-caption">
            <div><p className="flex items-center gap-1.5 text-muted-foreground"><ShareSwatch type="A" />Share A</p><p className="font-bold tabular-nums">{shares ? formatShares(shares.A) : '—'}</p></div>
            <div><p className="flex items-center gap-1.5 text-muted-foreground"><ShareSwatch type="B" />Share B</p><p className="font-bold tabular-nums">{shares ? formatShares(shares.B) : '—'}</p></div>
            <div><p className="flex items-center gap-1.5 text-muted-foreground"><i className="size-[12.5px] rounded-[3.75px] bg-steel/60" />Remaining</p><p className="font-bold tabular-nums">{shares ? formatShares(remaining) : '—'}</p></div>
          </div>
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="bg-share-a" style={{ width: `${shares?.total ? (shares.A / shares.total) * 100 : 0}%` }} />
            <span className="bg-share-b" style={{ width: `${shares?.total ? (shares.B / shares.total) * 100 : 0}%` }} />
          </div>
          <div className="flex justify-between pt-1.5 text-caption text-muted-foreground">
            <span>{shares ? formatShares(sold) : '—'} sold</span>
            <span>{shares ? formatShares(remaining) : '—'} remaining</span>
          </div>
        </section>

        <section className={cn(card, 'flex flex-col p-[18.75px]')}>
          <CardHeader title="KYC Overview" subtitle="Identity review status" />
          <StatRows
            rows={[
              ['Pending', users && formatInt(users.pending)],
              ['Approved', users && formatInt(users.approved)],
              ['Rejected', users && formatInt(users.rejected)],
              ['Locked', users && formatInt(users.locked)],
            ]}
          />
          <div className="mt-auto pt-3"><LinkAction to="/admin/users">Review KYC Applications</LinkAction></div>
        </section>

        <section className={cn(card, 'flex flex-col p-[18.75px]')}>
          <CardHeader title="Transaction Status" subtitle="Purchase processing status" />
          <StatRows
            rows={[
              ['Completed', overview && formatInt(overview.orders.completed)],
              ['Pending', overview && formatInt(overview.orders.pending)],
              ['Processing', overview && formatInt(overview.orders.processing)],
              ['Failed', overview && formatInt(failedOrders)],
            ]}
          />
          <div className="mt-auto pt-3"><LinkAction to="/admin/transactions">View Transactions</LinkAction></div>
        </section>
      </div>

      {/* Support, alerts, quick actions */}
      <div className="grid grid-cols-1 gap-[12.5px] lg:grid-cols-[1.5fr_1fr_0.9fr]">
        <section className={cn(card, 'p-[18.75px]')}>
          <CardHeader title="Support Overview" subtitle="Support queue performance" action={<LinkAction to="/admin/support">Open Support Inbox</LinkAction>} />
          <div className="grid grid-cols-2 gap-2.5 pt-4 sm:grid-cols-4">
            {[
              ['New', support?.new],
              ['In Progress', support?.inProgress],
              ['Waiting for User', support?.waiting],
              ['Resolved Today', support?.resolvedToday],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted px-3 py-2.5">
                <p className="text-caption text-muted-foreground">{label}</p>
                <p className="pt-1 text-subheading font-bold tabular-nums">{value ?? '—'}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-10 pt-4 text-caption">
            <div><p className="text-muted-foreground">Average First Response</p><p className="font-bold">{support ? formatDuration(support.avgFirstResponseMs) : '—'}</p></div>
            <div><p className="text-muted-foreground">Average Resolution Time</p><p className="font-bold">{support ? formatDuration(support.avgResolutionMs) : '—'}</p></div>
          </div>
        </section>

        <section className={cn(card, 'p-[18.75px]')}>
          <CardHeader title="Operational Alerts" subtitle="Items requiring awareness" />
          <ul className="space-y-2.5 pt-3">
            {alerts.length === 0 && <li className="text-caption text-muted-foreground">Nothing needs attention right now.</li>}
            {alerts.map(({ icon, text, to }) => {
              const Icon = icon
              return (
                <li key={text}>
                  <Link to={to} className="flex items-start gap-2.5 text-caption font-semibold hover:text-primary">
                    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning"><Icon className="size-3.5" /></span>
                    {text}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section className={cn(card, 'p-[18.75px]')}>
          <CardHeader title="Quick Actions" subtitle="Common operational workflows" />
          <ul className="pt-2">
            {quickActions.map(([label, to]) => (
              <li key={label} className="border-b border-divider last:border-0">
                <Link to={to} className="flex items-center justify-between py-[9px] text-caption hover:text-primary">
                  {label}
                  <ArrowRightIcon className="size-3.5 text-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Recent transactions */}
      <section className={cn(card, 'overflow-hidden')}>
        <div className="p-[18.75px] pb-3">
          <CardHeader title="Recent Transactions" subtitle="Latest Share purchase activity" action={<LinkAction to="/admin/transactions">View All Transactions</LinkAction>} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} pl-[18.75px]`}>Date</th>
                <th className={th}>Transaction ID</th>
                <th className={th}>User</th>
                <th className={th}>Share Type</th>
                <th className={th}>USDT Amount</th>
                <th className={th}>Share Quantity</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(recentOrders ?? []).map((o) => {
                const status = ORDER_STATUS[o.status]
                return (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className={`${td} pl-[18.75px] text-caption`}>{formatDate(o.createdAt)}</td>
                    <td className={`${td} text-caption font-bold`}>{o.orderCode}</td>
                    <td className={`${td} text-caption font-semibold`}>{o.user?.fullName}</td>
                    <td className={`${td} text-caption`}><span className="flex items-center gap-2"><ShareSwatch type={o.shareType} />Share {o.shareType}</span></td>
                    <td className={`${td} text-caption font-semibold tabular-nums`}>{formatUsdt(o.amount)} USDT</td>
                    <td className={`${td} text-caption tabular-nums text-muted-foreground`}>{formatShares(o.shares)}</td>
                    <td className={td}><StatusBadge tone={status?.tone} className="h-[26px]">{status?.label ?? o.status}</StatusBadge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {recentOrders && !recentOrders.length && <p className="py-10 text-center text-caption text-muted-foreground">No transactions yet.</p>}
        </div>
      </section>

      {/* Recent KYC */}
      <section className={cn(card, 'p-[18.75px]')}>
        <CardHeader title="Recent KYC Applications" subtitle="Latest identity review submissions" action={<LinkAction to="/admin/users">Review All</LinkAction>} />
        <ul className="pt-2">
          {(pendingKyc ?? []).map((u) => {
            const kyc = KYC_STATUS[u.kycStatus] ?? KYC_STATUS.pending
            const [first, ...rest] = (u.fullName ?? '').split(' ')
            const masked = `${first?.[0] ?? ''}•••• ${rest.at(-1)?.[0] ?? ''}.`
            return (
              <li key={u.id} className="flex items-center gap-3 border-b border-divider py-3 last:border-0">
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-muted text-caption font-bold">{first?.[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-caption font-bold">{masked}</p>
                  <p className="text-caption text-muted-foreground">{formatDateTime24(u.registeredAt)}</p>
                </div>
                <StatusBadge tone={kyc.tone} className="h-[26px]">{kyc.label}</StatusBadge>
                <button
                  type="button"
                  onClick={() => navigate('/admin/users?kycStatus=pending')}
                  className="h-[30px] rounded-md border px-3 text-caption font-bold hover:bg-muted"
                >
                  Review
                </button>
              </li>
            )
          })}
          {pendingKyc && !pendingKyc.length && <li className="py-8 text-center text-caption text-muted-foreground">No applications awaiting review.</li>}
        </ul>
      </section>
    </div>
  )
}
