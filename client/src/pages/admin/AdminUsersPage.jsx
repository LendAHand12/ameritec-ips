import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { ArrowDownToLineIcon, CheckIcon, MailWarningIcon, ScanFaceIcon, SearchIcon, ShieldCheckIcon, UsersIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import FilterSelect from '@/components/admin/FilterSelect'
import Pagination from '@/components/admin/Pagination'
import UserReviewDialog from '@/components/admin/UserReviewDialog'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { ACCOUNT_STATUS, DATE_RANGES, KYC_STATUS } from '@/lib/adminUsers'
import { formatDate, formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportUsers, listUsers } from '@/services/admin.service'

const PAGE_SIZE = 10
const FILTER_KEYS = ['q', 'kycStatus', 'emailStatus', 'faceStatus', 'accountStatus', 'registeredWithin', 'submittedWithin']
const FACE_FILTER = [
  { value: 'pending', label: 'Face scan: to review' },
  { value: 'none', label: 'Face scan: not added' },
  { value: 'approved', label: 'Face scan: approved' },
  { value: 'rejected', label: 'Face scan: rejected' },
]

const TABS = [
  { value: '', label: 'All Users', stat: 'total' },
  { value: 'pending', label: 'KYC Pending', stat: 'pending' },
  { value: 'approved', label: 'Approved', stat: 'approved' },
  { value: 'rejected', label: 'Rejected', stat: 'rejected' },
  // Registered but never confirmed their email — an admin can activate them by hand
  { value: '', emailStatus: 'unverified', label: 'Email Not Verified', stat: 'unverified' },
]

const KPIS = [
  { label: 'Total Users', stat: 'total', icon: UsersIcon },
  { label: 'Pending Review', stat: 'pending', icon: ShieldCheckIcon },
  { label: 'Approved', stat: 'approved', icon: CheckIcon },
  { label: 'Rejected', stat: 'rejected', icon: XCircleIcon },
]

const th = 'border-y border-divider bg-muted px-2.5 py-[11.25px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-2.5 py-[11.25px] whitespace-nowrap'

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function AdminUsersPage() {
  const { stats, refreshStats } = useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? '']))
  const page = Number(searchParams.get('page')) || 1

  const [search, setSearch] = useState(filters.q)
  const debouncedSearch = useDebounced(search.trim())
  const [selected, setSelected] = useState(() => new Set())
  const [reviewId, setReviewId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)

  /** Updates URL params; any filter change goes back to page 1 and clears the selection. */
  const setParams = useCallback(
    (patch, { keepPage = false } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
          if (!keepPage) next.delete('page')
          return next
        },
        { replace: true },
      )
      if (!keepPage) setSelected(new Set())
    },
    [setSearchParams],
  )

  useEffect(() => {
    if (debouncedSearch !== filters.q) setParams({ q: debouncedSearch })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = useMemo(
    () => Object.fromEntries(Object.entries({ ...filters, page, limit: PAGE_SIZE }).filter(([, v]) => v !== '')),
    [searchParams.toString(), page], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const { data, loading, error } = useAsync(() => listUsers(query), [query, reloadKey])
  const users = data?.data ?? []
  const pagination = data?.pagination

  const allVisibleSelected = users.length > 0 && users.every((u) => selected.has(u.id))
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      users.forEach((u) => (allVisibleSelected ? next.delete(u.id) : next.add(u.id)))
      return next
    })
  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleExport = async () => {
    setExporting(true)
    try {
      const { page: _p, limit: _l, ...rest } = query
      await exportUsers(selected.size ? { ids: [...selected].join(',') } : rest)
    } catch (err) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))
  }
  const hasFilters = FILTER_KEYS.some((k) => filters[k])

  const onReviewChanged = useCallback(() => {
    setReloadKey((k) => k + 1)
    refreshStats()
  }, [refreshStats])
  const closeReview = useCallback(() => setReviewId(null), [])

  const from = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0
  const to = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Users &amp; KYC</h1>
          <p className="pt-[6.25px] text-title text-muted-foreground">
            Manage investor accounts and review identity verification applications.
          </p>
        </div>
        <Button className="h-[50px] min-w-[115px] gap-3 px-[21.25px] text-title font-bold" onClick={handleExport} disabled={exporting}>
          {selected.size ? `Export (${selected.size})` : 'Export'}
          {exporting ? <Spinner className="size-5" /> : <ArrowDownToLineIcon className="size-[22.5px]" />}
        </Button>
      </div>

      {/* KYC status tabs */}
      <div role="tablist" aria-label="KYC status" className="mt-[18.75px] flex overflow-x-auto rounded-lg border bg-card p-[5px]">
        {TABS.map((tab) => {
          const active = filters.kycStatus === tab.value && filters.emailStatus === (tab.emailStatus ?? '')
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParams({ kycStatus: tab.value, emailStatus: tab.emailStatus ?? '' })}
              className={cn(
                'flex min-h-[52.5px] flex-1 items-center justify-center gap-[8.75px] rounded-[7.5px] px-4 text-title whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted',
                active && 'bg-primary-soft font-bold text-foreground hover:bg-primary-soft',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'min-w-[30px] rounded-full px-[6.25px] py-[3.75px] text-center font-bold',
                  active ? 'bg-primary text-white' : 'bg-muted text-subtle',
                )}
              >
                {stats ? formatInt(stats[tab.stat]) : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {stats?.facePending > 0 && (
        <button
          type="button"
          onClick={() => setParams({ faceStatus: 'pending', kycStatus: '', emailStatus: '' })}
          className="mt-[12.5px] flex w-full flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-left transition-colors hover:border-warning/60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-warning">
            <ScanFaceIcon className="size-5" />
          </span>
          <span className="flex-1 text-title">
            <span className="font-bold">
              {stats.facePending} face scan{stats.facePending > 1 ? 's' : ''} awaiting review
            </span>
            <span className="text-muted-foreground"> · approving one releases the commission it was holding back</span>
          </span>
          <span className="text-title font-semibold text-primary">Review →</span>
        </button>
      )}

      {/* KPIs */}
      <div className="mt-[12.5px] grid grid-cols-2 gap-[11.25px] xl:grid-cols-4">
        {KPIS.map(({ label, stat, icon }) => {
          const Icon = icon
          return (
            <article key={label} className="flex items-center gap-[12.5px] rounded-lg border bg-card px-3 py-[15px] sm:px-[17.5px] shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
              <span className="flex size-[37.5px] items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
                <Icon className="size-[21.25px]" />
              </span>
              <div className="space-y-[5px]">
                <p className="text-caption text-muted-foreground">{label}</p>
                <p className="text-title font-bold tabular-nums">{stats ? formatInt(stats[stat]) : '—'}</p>
              </div>
            </article>
          )
        })}
      </div>

      {/* Table card */}
      <section className="mt-[12.5px] overflow-hidden rounded-[11.25px] border bg-card shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
        <div className="flex flex-wrap items-center gap-[8.75px] border-b border-divider bg-muted px-[18.75px] py-[13.75px]">
          <label className="flex h-[42.5px] w-full items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30 lg:w-[300px]">
            <SearchIcon className="size-5 shrink-0 text-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone, ref code"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              aria-label="Search users"
            />
          </label>
          <div className="grid w-full grid-cols-1 gap-[8.75px] sm:grid-cols-2 lg:w-auto lg:flex-1 xl:grid-cols-5">
            <FilterSelect
              label="KYC status"
              allLabel="All KYC Statuses"
              options={Object.entries(KYC_STATUS).map(([value, s]) => ({ value, label: s.label }))}
              value={filters.kycStatus}
              onChange={(v) => setParams({ kycStatus: v })}
            />
            <FilterSelect
              label="Face scan"
              allLabel="All Face Scans"
              options={FACE_FILTER}
              value={filters.faceStatus}
              onChange={(v) => setParams({ faceStatus: v })}
            />
            <FilterSelect
              label="Account status"
              allLabel="All Account Statuses"
              options={Object.entries(ACCOUNT_STATUS).map(([value, s]) => ({ value, label: s.label }))}
              value={filters.accountStatus}
              onChange={(v) => setParams({ accountStatus: v })}
            />
            <FilterSelect
              label="Registration date"
              allLabel="All Registration Dates"
              options={DATE_RANGES}
              value={filters.registeredWithin}
              onChange={(v) => setParams({ registeredWithin: v })}
            />
            <FilterSelect
              label="Submission date"
              allLabel="All Submission Dates"
              options={DATE_RANGES}
              value={filters.submittedWithin}
              onChange={(v) => setParams({ submittedWithin: v })}
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters && !search}
            className="h-[42.5px] px-3 text-title font-semibold whitespace-nowrap text-primary hover:underline disabled:text-subtle disabled:no-underline"
          >
            Reset Filters
          </button>
        </div>

        <div className={cn('overflow-x-auto transition-opacity', loading && data && 'opacity-50')}>
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-[47.5px] pl-5`}>
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all visible users" disabled={!users.length} />
                </th>
                <th className={th}>Investor</th>
                <th className={th}>Email / Ref Code</th>
                <th className={th}>Referred By</th>
                <th className={th}>Registered</th>
                <th className={th}>KYC Status</th>
                <th className={th}>Account Status</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const kyc = KYC_STATUS[u.kycStatus]
                const account = ACCOUNT_STATUS[u.accountStatus]
                return (
                  <tr key={u.id} className={cn('transition-colors hover:bg-muted/40', selected.has(u.id) && 'bg-primary-soft/40')}>
                    <td className={`${td} pl-5`}>
                      <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggleOne(u.id)} aria-label={`Select ${u.fullName}`} />
                    </td>
                    <td className={`${td} text-title font-semibold`}>{u.fullName}</td>
                    <td className={td}>
                      <p className="text-title">{u.email}</p>
                      <p className="text-caption text-muted-foreground">{u.referralCode}</p>
                    </td>
                    <td className={td}>
                      {u.referredBy ? <p className="text-title font-semibold">{u.referredBy.fullName}</p> : <span className="text-subtle">—</span>}
                    </td>
                    <td className={`${td} text-title text-muted-foreground`}>{formatDate(u.registeredAt)}</td>
                    <td className={td}>
                      {u.faceStatus === 'pending' && (
                        <StatusBadge tone="warning" icon={false} className="mb-1.5 block w-fit">
                          Face scan to review
                        </StatusBadge>
                      )}
                      {u.emailVerified ? (
                        <StatusBadge tone={kyc.tone} icon={false}>{kyc.label}</StatusBadge>
                      ) : (
                        <StatusBadge tone="danger" icon={false}>
                          <MailWarningIcon className="size-4" />
                          Email not verified
                        </StatusBadge>
                      )}
                    </td>
                    <td className={td}>
                      <StatusBadge tone={account.tone} icon={false}>{account.label}</StatusBadge>
                    </td>
                    <td className={td}>
                      <Button variant="outline" className="h-[35px] rounded-lg px-[11.25px] text-title font-bold" onClick={() => setReviewId(u.id)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!data && loading && (
            <div className="flex justify-center py-16">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          )}
          {error && <p className="py-12 text-center text-destructive">{error.message}</p>}
          {data && !users.length && (
            <p className="py-12 text-center text-title text-muted-foreground">
              {hasFilters ? 'No users match your filters.' : 'No users yet.'}
            </p>
          )}
        </div>

        <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p className="text-title text-muted-foreground">
            {pagination?.total ? `Showing ${formatInt(from)}–${formatInt(to)} of ${formatInt(pagination.total)} users` : ''}
          </p>
          {pagination && (
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={(p) => setParams({ page: String(p) }, { keepPage: true })} />
          )}
        </div>
      </section>

      <UserReviewDialog userId={reviewId} onClose={closeReview} onChanged={onReviewChanged} />
    </>
  )
}
