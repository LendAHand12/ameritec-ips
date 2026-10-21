import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BanknoteIcon, ClockIcon, CoinsIcon, CopyIcon, ExternalLinkIcon, SearchIcon, UsersIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import FilterSelect from '@/components/admin/FilterSelect'
import Pagination from '@/components/admin/Pagination'
import UserReviewDialog from '@/components/admin/UserReviewDialog'
import SegmentedControl from '@/components/dashboard/SegmentedControl'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { useAsync } from '@/hooks/useAsync'
import { useDebounced } from '@/hooks/useDebounced'
import { KYC_STATUS } from '@/lib/adminUsers'
import { formatInt, formatPercent, formatShortDate, formatUsdt, formatShares, formatDateTime24 } from '@/lib/format'
import { cn } from '@/lib/utils'
import { bscscanTxUrl } from '@/lib/orders'
import { getReferralSummary, listReferralCommissions, listReferrers, listWithdrawals, markWithdrawalPaid, rejectWithdrawal } from '@/services/admin.service'

const PAGE_SIZE = 10
const RANGES = [
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
]
const TABS = [
  { value: 'commissions', label: 'Commission Ledger' },
  { value: 'referrers', label: 'Referrers' },
  { value: 'withdrawals', label: 'Withdrawals' },
]
const COMMISSION_STATUS = {
  available: { label: 'Available', tone: 'success' },
  pending: { label: 'Pending KYC', tone: 'warning' },
}

const WITHDRAWAL_STATUS = {
  pending: { label: 'Awaiting payment', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}
const shortAddress = (a = '') => `${a.slice(0, 8)}…${a.slice(-6)}`

/** Mark a withdrawal as paid once the USDT has been sent; the tx hash is optional but recommended. */
function PaidDialog({ withdrawal, onClose, onDone }) {
  const [txHash, setTxHash] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await markWithdrawalPaid(withdrawal.id, txHash.trim())
      toast.success(`${withdrawal.code} marked as paid`)
      onDone()
    } catch (err) {
      setError(err.details?.txHash ?? err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Mark {withdrawal.code} as paid</DialogTitle>
            <DialogDescription>Only confirm after you have sent the USDT. The user sees it as paid.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/50 p-3 text-caption">
            <p className="text-muted-foreground">Send exactly</p>
            <p className="text-subheading font-bold tabular-nums">{formatUsdt(withdrawal.amount)} USDT</p>
            <p className="pt-1 text-muted-foreground">to ({'BNB Smart Chain'})</p>
            <p className="flex items-start gap-2 font-mono font-semibold break-all">
              {withdrawal.address}
              <button type="button" aria-label="Copy address" className="mt-0.5 shrink-0 text-primary" onClick={() => navigator.clipboard.writeText(withdrawal.address).then(() => toast.success('Address copied'))}>
                <CopyIcon className="size-3.5" />
              </button>
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="paid-tx" className="text-caption font-semibold">
              Transaction hash <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="paid-tx"
              value={txHash}
              onChange={(e) => {
                setTxHash(e.target.value)
                setError('')
              }}
              placeholder="0x…"
              spellCheck={false}
              className="font-mono text-sm"
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Confirm paid
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Declining a withdrawal returns the amount to the user's available balance immediately. */
function RejectDialog({ withdrawal, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await rejectWithdrawal(withdrawal.id, reason.trim())
      toast.success(`${withdrawal.code} rejected — amount returned to the user`)
      onDone()
    } catch (err) {
      toast.error(err.details?.reason ?? err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Reject {withdrawal.code}</DialogTitle>
            <DialogDescription>{formatUsdt(withdrawal.amount)} USDT goes straight back to {withdrawal.user?.fullName}’s available balance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="reject-reason" className="text-caption font-semibold">
              Reason (shown to the user)
            </label>
            <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={saving || !reason.trim()}>
              {saving && <Spinner />}
              Reject withdrawal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const card = 'rounded-[11.25px] border bg-card shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]'
const th = 'border-y border-divider bg-muted px-2.5 py-[11.25px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-2.5 py-[11.25px] whitespace-nowrap'

function Kpi({ label, value, unit, note, icon, tone = 'brand' }) {
  const Icon = icon
  return (
    <article className="flex items-center gap-[12.5px] rounded-lg border bg-card px-3 py-[15px] shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)] sm:px-[17.5px]">
      <span className={cn('flex size-[37.5px] shrink-0 items-center justify-center rounded-[8.75px]', tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary')}>
        <Icon className="size-[21.25px]" />
      </span>
      <div className="min-w-0 space-y-[5px]">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className="text-title font-bold tabular-nums">
          {value ?? '—'}
          {unit && <span className="pl-1.5 text-caption font-medium text-muted-foreground">{unit}</span>}
        </p>
        {note && <p className="text-caption text-muted-foreground">{note}</p>}
      </div>
    </article>
  )
}

function PersonCell({ person, onOpen, canOpen }) {
  if (!person) return <span className="text-subtle">Deleted user</span>
  return (
    <div>
      {canOpen ? (
        <button type="button" onClick={() => onOpen(person.id)} className="text-left text-title font-semibold hover:text-primary hover:underline">
          {person.fullName}
        </button>
      ) : (
        <p className="text-title font-semibold">{person.fullName}</p>
      )}
      <p className="text-caption text-muted-foreground">{person.referralCode}</p>
    </div>
  )
}

export default function AdminReferralsPage() {
  const { can } = useAdminAuth()
  const canOpenUser = can('users:view')
  const [range, setRange] = useState('30')
  const [tab, setTab] = useState('commissions')
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [reviewId, setReviewId] = useState(null)
  const [settling, setSettling] = useState(null) // { type: 'paid' | 'reject', withdrawal }
  const canManage = can('referrals:manage')
  const [reloadKey, setReloadKey] = useState(0)

  const { data: summary } = useAsync(() => getReferralSummary({ range }).then((r) => r.data), [range, reloadKey])
  const query = useMemo(
    () => Object.fromEntries(Object.entries({ q, status: tab === 'referrers' ? '' : status, page, limit: PAGE_SIZE }).filter(([, v]) => v !== '')),
    [q, status, page, tab],
  )
  const { data: loaded, loading } = useAsync(
    () => (tab === 'commissions' ? listReferralCommissions(query) : tab === 'withdrawals' ? listWithdrawals(query) : listReferrers(query)).then((res) => ({ ...res, tab })),
    [tab, query, reloadKey],
  )
  // useAsync keeps the previous result while reloading: never draw one tab's rows in the other tab's table
  const data = loaded?.tab === tab ? loaded : null
  const rows = data?.data ?? []
  const pagination = data?.pagination

  const changeTab = (value) => {
    setTab(value)
    setPage(1)
    setStatus('')
    setSearch('')
  }
  const closeReview = useCallback(() => setReviewId(null), [])
  const onSettled = () => {
    setSettling(null)
    setReloadKey((k) => k + 1)
  }
  const onChanged = useCallback(() => setReloadKey((k) => k + 1), [])

  const chart = (summary?.series ?? []).map((p) => ({ ...p, label: formatShortDate(`${p.date}T12:00:00`) }))
  const change = summary?.range.changePct

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Referral &amp; Commission</h1>
          <p className="pt-[6.25px] text-title text-muted-foreground">Track referral commissions, who earns them and when they become withdrawable.</p>
        </div>
        <SegmentedControl label="Period" options={RANGES} value={range} onChange={setRange} />
      </div>

      {summary?.withdrawals.pendingCount > 0 && (
        <button
          type="button"
          onClick={() => {
            changeTab('withdrawals')
            setStatus('pending')
          }}
          className="mt-[18.75px] flex w-full flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-left transition-colors hover:border-warning/60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-warning">
            <BanknoteIcon className="size-5" />
          </span>
          <span className="flex-1 text-title">
            <span className="font-bold">
              {summary.withdrawals.pendingCount} withdrawal{summary.withdrawals.pendingCount > 1 ? 's' : ''} awaiting payment
            </span>
            <span className="text-muted-foreground"> · {formatUsdt(summary.withdrawals.pendingAmount)} USDT to send</span>
          </span>
          <span className="text-title font-semibold text-primary">Review →</span>
        </button>
      )}

      <div className="mt-[12.5px] grid grid-cols-1 gap-[11.25px] sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total commission" value={summary && formatUsdt(summary.total)} unit="USDT" note={summary && `${formatInt(summary.count)} payouts`} icon={CoinsIcon} />
        <Kpi label="Available (withdrawable)" value={summary && formatUsdt(summary.available)} unit="USDT" icon={WalletIcon} />
        <Kpi label="Pending KYC approval" value={summary && formatUsdt(summary.pending)} unit="USDT" note="Released once earner & buyer are approved" icon={ClockIcon} tone="warning" />
        <Kpi
          label="Network"
          value={summary && `${formatInt(summary.referrers)} referrers`}
          note={summary && `${formatInt(summary.referredUsers)} referred users`}
          icon={UsersIcon}
        />
      </div>

      <div className="mt-[12.5px] grid grid-cols-1 gap-[12.5px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className={cn(card, 'p-[18.75px]')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-title font-bold">Commission paid</h2>
              <p className="pt-[3.75px] text-caption text-muted-foreground">Daily commission credited to referrers · last {range} days</p>
            </div>
            <div className="text-right">
              <p className="text-subheading font-bold tabular-nums">
                {summary ? formatUsdt(summary.range.total) : '—'} <span className="text-caption font-medium text-muted-foreground">USDT</span>
              </p>
              {change != null && (
                <span className={cn('text-caption font-semibold', change >= 0 ? 'text-success' : 'text-danger')}>{formatPercent(change)} vs previous period</span>
              )}
            </div>
          </div>
          <div className="mt-3 h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--divider)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--subtle)' }} minTickGap={24} />
                <YAxis width={44} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--subtle)' }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
                  formatter={(v) => [`${formatUsdt(v)} USDT`, 'Commission']}
                />
                <Bar dataKey="amount" fill="var(--primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cn(card, 'flex flex-col p-[18.75px]')}>
          <h2 className="text-title font-bold">Commission rates</h2>
          <p className="pt-[3.75px] text-caption text-muted-foreground">Paid to the buyer’s direct referrer (F1) on each completed purchase.</p>
          <dl className="mt-3 divide-y divide-divider">
            {['A', 'B'].map((t) => (
              <div key={t} className="flex items-center justify-between py-3">
                <dt className="flex items-center gap-2 text-title">
                  <ShareSwatch type={t} />
                  Class {t}
                </dt>
                <dd className="text-subheading font-bold tabular-nums">{summary ? `${summary.ratePct[t]}%` : '—'}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-auto rounded-lg bg-muted px-3 py-2.5 text-caption text-muted-foreground">
            A commission stays <span className="font-semibold text-warning">pending</span> until both the referrer and the buyer are KYC-approved.
            {can('parameters:view') && (
              <>
                {' '}
                <Link to="/admin/parameters" className="font-semibold text-primary hover:underline">
                  Change rates
                </Link>
              </>
            )}
          </p>
        </section>
      </div>

      <div role="tablist" aria-label="Referral data" className="mt-[12.5px] flex rounded-lg border bg-card p-[5px]">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => changeTab(t.value)}
            className={cn(
              'flex min-h-[46px] flex-1 items-center justify-center rounded-[7.5px] px-4 text-title whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted',
              tab === t.value && 'bg-primary-soft font-bold text-foreground hover:bg-primary-soft',
            )}
          >
            {t.label}
            {t.value === 'withdrawals' && summary?.withdrawals.pendingCount > 0 && (
              <span className="ml-2 min-w-[24px] rounded-full bg-primary px-1.5 py-0.5 text-center text-caption font-bold text-white">{summary.withdrawals.pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <section className={cn(card, 'mt-[12.5px] overflow-hidden')}>
        <div className="flex flex-wrap items-center gap-[8.75px] border-b border-divider bg-muted px-[18.75px] py-[13.75px]">
          <label className="flex h-[42.5px] w-full items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30 lg:w-[320px]">
            <SearchIcon className="size-5 shrink-0 text-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder={tab === 'commissions' ? 'Name, referral code, order' : tab === 'withdrawals' ? 'Name, code or wallet' : 'Name or referral code'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              aria-label="Search"
            />
          </label>
          {tab !== 'referrers' && (
            <div className="w-full sm:w-[220px]">
              <FilterSelect
                label="Status"
                allLabel="All Statuses"
                options={Object.entries(tab === 'withdrawals' ? WITHDRAWAL_STATUS : COMMISSION_STATUS).map(([value, s]) => ({ value, label: s.label }))}
                value={status}
                onChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              />
            </div>
          )}
          {(search || status) && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatus('')
                setPage(1)
              }}
              className="h-[42.5px] px-3 text-title font-semibold whitespace-nowrap text-primary hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className={cn('overflow-x-auto transition-opacity', loading && data && 'opacity-50')}>
          {tab === 'commissions' && (
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr>
                  <th className={`${th} pl-5`}>Date</th>
                  <th className={th}>Earner (referrer)</th>
                  <th className={th}>Buyer</th>
                  <th className={th}>Order</th>
                  <th className={th}>Purchase</th>
                  <th className={th}>Rate</th>
                  <th className={th}>Commission</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const s = COMMISSION_STATUS[c.status]
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-muted/40">
                      <td className={`${td} pl-5 text-title text-muted-foreground`}>{formatDateTime24(c.date)}</td>
                      <td className={td}>
                        <PersonCell person={c.earner} onOpen={setReviewId} canOpen={canOpenUser} />
                      </td>
                      <td className={td}>
                        <PersonCell person={c.buyer} onOpen={setReviewId} canOpen={canOpenUser} />
                      </td>
                      <td className={`${td} text-title font-semibold`}>{c.orderCode}</td>
                      <td className={td}>
                        <p className="flex items-center gap-2 text-title font-semibold tabular-nums">
                          <ShareSwatch type={c.shareType} />
                          {formatUsdt(c.orderAmount)} USDT
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {formatShares(c.shares)} Class {c.shareType} shares
                        </p>
                      </td>
                      <td className={`${td} text-title`}>{c.ratePct}%</td>
                      <td className={`${td} text-title font-bold tabular-nums`}>{formatUsdt(c.amount)} USDT</td>
                      <td className={td}>
                        <StatusBadge tone={s.tone} icon={false}>
                          {s.label}
                        </StatusBadge>
                        {c.status === 'available' && c.releasedAt && <p className="pt-1 text-caption text-muted-foreground">Released {formatDateTime24(c.releasedAt)}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {tab === 'referrers' && (
            <table className="w-full min-w-[1120px] border-collapse">
              <thead>
                <tr>
                  <th className={`${th} pl-5`}>Referrer</th>
                  <th className={th}>KYC</th>
                  <th className={th}>Direct referrals (F1)</th>
                  <th className={th}>Direct sales (F1)</th>
                  <th className={th}>Team sales (all levels)</th>
                  <th className={th}>Available</th>
                  <th className={th}>Pending</th>
                  <th className={th}>Total earned</th>
                  <th className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const kyc = KYC_STATUS[r.kycStatus]
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-muted/40">
                      <td className={`${td} pl-5`}>
                        <p className="text-title font-semibold">{r.fullName}</p>
                        <p className="text-caption text-muted-foreground">{r.referralCode}</p>
                      </td>
                      <td className={td}>
                        <StatusBadge tone={kyc.tone} icon={false}>
                          {kyc.label}
                        </StatusBadge>
                      </td>
                      <td className={td}>
                        <p className="text-title font-semibold tabular-nums">{formatInt(r.referred)}</p>
                        <p className="text-caption text-muted-foreground">{formatInt(r.referredApproved)} KYC-approved</p>
                      </td>
                      <td className={`${td} text-title font-semibold tabular-nums`}>{formatUsdt(r.directSales)} USDT</td>
                      <td className={`${td} text-title font-semibold tabular-nums`}>
                        {formatUsdt(r.teamSales)} USDT
                        <p className="text-caption font-normal text-muted-foreground">{formatInt(r.teamMembers)} in downline</p>
                      </td>
                      <td className={`${td} text-title tabular-nums`}>{formatUsdt(r.available)} USDT</td>
                      <td className={`${td} text-title tabular-nums ${r.pending > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{formatUsdt(r.pending)} USDT</td>
                      <td className={`${td} text-title font-bold tabular-nums`}>{formatUsdt(r.total)} USDT</td>
                      <td className={td}>
                        {canOpenUser ? (
                          <Button variant="outline" className="h-[35px] rounded-lg px-[11.25px] text-title font-bold" onClick={() => setReviewId(r.id)}>
                            View
                          </Button>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {tab === 'withdrawals' && (
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr>
                  <th className={`${th} pl-5`}>Request</th>
                  <th className={th}>User</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Wallet (BEP20)</th>
                  <th className={th}>Status</th>
                  <th className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => {
                  const s = WITHDRAWAL_STATUS[w.status]
                  return (
                    <tr key={w.id} className="transition-colors hover:bg-muted/40">
                      <td className={`${td} pl-5`}>
                        <p className="text-title font-semibold">{w.code}</p>
                        <p className="text-caption text-muted-foreground">{formatDateTime24(w.date)}</p>
                      </td>
                      <td className={td}>
                        <PersonCell person={w.user} onOpen={setReviewId} canOpen={canOpenUser} />
                      </td>
                      <td className={`${td} text-title font-bold tabular-nums`}>{formatUsdt(w.amount)} USDT</td>
                      <td className={td}>
                        <span className="flex items-center gap-2 font-mono text-caption">
                          {shortAddress(w.address)}
                          <button
                            type="button"
                            aria-label="Copy wallet address"
                            className="text-primary"
                            onClick={() => navigator.clipboard.writeText(w.address).then(() => toast.success('Address copied'))}
                          >
                            <CopyIcon className="size-3.5" />
                          </button>
                        </span>
                      </td>
                      <td className={td}>
                        <StatusBadge tone={s.tone} icon={false}>
                          {s.label}
                        </StatusBadge>
                        {w.txHash && (
                          <a href={bscscanTxUrl(w.txHash)} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-caption font-semibold text-primary hover:underline">
                            tx <ExternalLinkIcon className="size-3" />
                          </a>
                        )}
                        {w.status === 'rejected' && w.rejectionReason && <p className="max-w-[200px] truncate pt-1 text-caption text-muted-foreground">{w.rejectionReason}</p>}
                      </td>
                      <td className={td}>
                        {w.status === 'pending' && canManage ? (
                          <span className="flex gap-2">
                            <Button className="h-[35px] rounded-lg px-[11.25px] text-title font-bold" onClick={() => setSettling({ type: 'paid', withdrawal: w })}>
                              Mark paid
                            </Button>
                            <Button variant="outline" className="h-[35px] rounded-lg px-[11.25px] text-title font-bold text-destructive" onClick={() => setSettling({ type: 'reject', withdrawal: w })}>
                              Reject
                            </Button>
                          </span>
                        ) : (
                          <span className="text-subtle">{w.processedAt ? formatDateTime24(w.processedAt) : '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {!data && <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}
          {data && !rows.length && (
            <p className="py-12 text-center text-title text-muted-foreground">
              {tab === 'commissions' ? 'No commissions match your filters.' : tab === 'withdrawals' ? 'No withdrawal requests yet.' : 'No referrers match your search.'}
            </p>
          )}
        </div>

        <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p className="text-title text-muted-foreground">
            {pagination?.total ? `${formatInt(pagination.total)} ${tab === 'commissions' ? 'commissions' : tab === 'withdrawals' ? 'withdrawals' : 'referrers'}` : ''}
          </p>
          {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />}
        </div>
      </section>

      <UserReviewDialog userId={reviewId} onClose={closeReview} onChanged={onChanged} />
      {settling?.type === 'paid' && <PaidDialog withdrawal={settling.withdrawal} onClose={() => setSettling(null)} onDone={onSettled} />}
      {settling?.type === 'reject' && <RejectDialog withdrawal={settling.withdrawal} onClose={() => setSettling(null)} onDone={onSettled} />}
    </>
  )
}
