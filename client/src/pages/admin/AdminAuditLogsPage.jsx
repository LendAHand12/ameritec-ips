import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownToLineIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import AuditLogDrawer from '@/components/admin/AuditLogDrawer'
import FilterSelect from '@/components/admin/FilterSelect'
import Pagination from '@/components/admin/Pagination'
import StatCard from '@/components/admin/StatCard'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { useDebounced } from '@/hooks/useDebounced'
import { formatDateTime24, formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportAuditLogs, getAuditMeta, getAuditStats, listAuditLogs } from '@/services/admin.service'

const FILTER_KEYS = ['q', 'category', 'action', 'admin', 'recordType', 'result']
const DEFAULT_DAYS = '30'
const RANGES = [
  { value: '1', label: '24 Hours' },
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
  { value: '365', label: '12 Months' },
  { value: 'all', label: 'All Time' },
]
const RESULTS = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failed' },
]
const th = 'border-y border-divider bg-muted px-3 py-[12.5px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-3 py-[16.25px] text-caption whitespace-nowrap'
const selectClass = 'h-[42.5px] w-full rounded-lg bg-card text-caption text-foreground'

/** Where a record reference leads inside the admin portal. */
function recordLink(record) {
  const q = encodeURIComponent(record.ref ?? '')
  if (!record.ref) return null
  if (record.type === 'user') return `/admin/users?q=${q}`
  if (record.type === 'order') return `/admin/transactions?q=${q}`
  if (record.type === 'ticket') return `/admin/support/tickets/${record.id}`
  if (record.type === 'article') return '/admin/support?tab=catalog'
  if (record.type === 'settings') return '/admin/parameters'
  return null
}

export default function AdminAuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? '']))
  const range = searchParams.get('range') ?? DEFAULT_DAYS
  const days = range === 'all' ? '' : range
  const page = Number(searchParams.get('page')) || 1
  const [search, setSearch] = useState(filters.q)
  const debouncedSearch = useDebounced(search.trim())
  const [reloadKey, setReloadKey] = useState(0)
  const [selected, setSelected] = useState(null)
  const [exporting, setExporting] = useState(false)

  const setParams = useCallback(
    (patch, { keepPage = false } = {}) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
          if (!keepPage) next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setSearchParams],
  )

  useEffect(() => {
    if (debouncedSearch !== filters.q) setParams({ q: debouncedSearch })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = useMemo(
    () => Object.fromEntries(Object.entries({ ...filters, days, page, limit: 10 }).filter(([, v]) => v !== '')),
    [searchParams.toString(), page], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const { data, loading } = useAsync(() => listAuditLogs(query), [query, reloadKey])
  const { data: stats } = useAsync(() => getAuditStats(days ? { days } : {}), [days, reloadKey])
  const { data: meta } = useAsync(getAuditMeta, [])
  const [updatedAt, setUpdatedAt] = useState(null)
  useEffect(() => {
    if (data) setUpdatedAt(new Date())
  }, [data])

  const logs = data?.data ?? []
  const pagination = data?.pagination
  const from = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0
  const to = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0
  const filtering = FILTER_KEYS.some((k) => filters[k])
  const actionOptions = (meta?.actions ?? []).filter((a) => !filters.category || a.category === filters.category)

  const handleExport = async () => {
    setExporting(true)
    try {
      const { page: _p, limit: _l, ...exportQuery } = query
      await exportAuditLogs(exportQuery)
    } catch (err) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const cards = [
    { label: 'Total Events', value: stats?.total, onClick: () => setParams({ category: '' }) },
    { label: 'Admin Actions', value: stats?.adminActions },
    { label: 'Security Events', value: stats?.security, onClick: () => setParams({ category: 'security', action: '' }) },
    { label: 'Configuration Changes', value: stats?.configuration, onClick: () => setParams({ category: 'parameters', action: '' }) },
  ]

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Audit Logs</h1>
          <p className="pt-[6.25px] text-caption text-muted-foreground">
            Review administrative actions and important system changes across Ameritec IPS.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="w-[140px] space-y-[5px]">
            <span className="block text-caption font-semibold text-muted-foreground">Date Range</span>
            <FilterSelect
              label="Date range"
              allLabel="All Time"
              options={RANGES.filter((r) => r.value !== 'all')}
              value={range === 'all' ? '' : range}
              onChange={(v) => setParams({ range: v || 'all' })}
              className={selectClass}
            />
          </div>
          <Button
            variant="outline"
            className="h-[42.5px] gap-2 rounded-lg bg-card px-[17.5px] font-bold"
            onClick={handleExport}
            disabled={exporting || !pagination?.total}
          >
            Export
            {exporting ? <Spinner className="size-4" /> : <ArrowDownToLineIcon className="size-[18.75px]" />}
          </Button>
          <Button variant="outline" className="h-[42.5px] rounded-lg bg-card px-[17.5px] font-bold" onClick={() => setReloadKey((k) => k + 1)}>
            Refresh
          </Button>
          <div className="space-y-[5px] pl-2.5">
            <span className="block text-caption text-muted-foreground">Last Updated</span>
            <span className="block text-title font-bold tabular-nums">{updatedAt ? formatDateTime24(updatedAt) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value != null ? formatInt(c.value) : null} onClick={c.onClick} />
        ))}
      </div>

      <label className="mt-2.5 flex h-[42.5px] items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30">
        <SearchIcon className="size-5 shrink-0 text-subtle" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by admin, record ID, action or description"
          className="min-w-0 flex-1 bg-transparent text-caption outline-none placeholder:text-subtle"
          aria-label="Search audit logs"
        />
      </label>

      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <FilterSelect
          label="Category"
          allLabel="All Categories"
          options={meta?.categories ?? []}
          value={filters.category}
          onChange={(v) => setParams({ category: v, action: '' })}
          className={selectClass}
        />
        <FilterSelect
          label="Action"
          allLabel="All Actions"
          options={actionOptions}
          value={filters.action}
          onChange={(v) => setParams({ action: v })}
          className={selectClass}
        />
        <FilterSelect
          label="Admin"
          allLabel="All Admins"
          options={meta?.admins ?? []}
          value={filters.admin}
          onChange={(v) => setParams({ admin: v })}
          className={selectClass}
        />
        <FilterSelect
          label="Record type"
          allLabel="All Record Types"
          options={meta?.recordTypes ?? []}
          value={filters.recordType}
          onChange={(v) => setParams({ recordType: v })}
          className={selectClass}
        />
        <FilterSelect
          label="Result"
          allLabel="All Results"
          options={RESULTS}
          value={filters.result}
          onChange={(v) => setParams({ result: v })}
          className={selectClass}
        />
        <button
          type="button"
          onClick={() => {
            setSearch('')
            setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))
          }}
          className="h-[42.5px] px-3 text-caption font-bold whitespace-nowrap text-primary hover:underline"
        >
          Reset Filters
        </button>
      </div>

      <section className="mt-2.5 overflow-hidden rounded-xl border bg-card shadow-[0_1.25px_2.5px_rgb(0_0_0/0.04)]">
        <div className={cn('overflow-x-auto transition-opacity', loading && data && 'opacity-50')}>
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} pl-[25px]`}>Date &amp; Time</th>
                <th className={th}>Admin / Actor</th>
                <th className={th}>Category</th>
                <th className={th}>Action</th>
                <th className={th}>Related Record</th>
                <th className={th}>Description</th>
                <th className={th}>Result</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const link = l.record && recordLink(l.record)
                return (
                  <tr key={l.id} className="transition-colors hover:bg-muted/40">
                    <td className={`${td} pl-[25px] text-muted-foreground`}>{formatDateTime24(l.createdAt)}</td>
                    <td className={td}>
                      <p className="font-semibold">{l.actor.name ?? l.actor.email ?? 'Unknown'}</p>
                      <p className="pt-[3.3px] text-muted-foreground">{l.actor.name ? 'Administrator' : 'Unrecognised account'}</p>
                    </td>
                    <td className={`${td} text-muted-foreground`}>{l.categoryLabel}</td>
                    <td className={`${td} font-semibold`}>{l.actionLabel}</td>
                    <td className={td}>
                      {!l.record ? (
                        <span className="text-subtle">—</span>
                      ) : link ? (
                        <Link to={link} className="font-semibold text-primary hover:underline">
                          {l.record.ref ?? l.record.typeLabel}
                        </Link>
                      ) : (
                        <span className="font-semibold text-muted-foreground">{l.record.ref ?? l.record.typeLabel}</span>
                      )}
                    </td>
                    <td className={cn(td, 'max-w-[340px] min-w-[200px] whitespace-normal text-muted-foreground')}>
                      <span className="line-clamp-2" title={l.error ?? l.description ?? undefined}>
                        {l.result === 'failure' && l.error ? l.error : (l.description ?? '—')}
                      </span>
                    </td>
                    <td className={td}>
                      <StatusBadge tone={l.result === 'success' ? 'success' : 'danger'} icon={false}>
                        {l.result === 'success' ? 'Success' : 'Failed'}
                      </StatusBadge>
                    </td>
                    <td className={td}>
                      <Button variant="outline" className="h-[35px] rounded-lg bg-card px-2.5 text-title font-bold" onClick={() => setSelected(l)}>
                        View
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!data && <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}
          {data && !logs.length && (
            <p className="py-12 text-center text-title text-muted-foreground">
              {filtering ? 'No events match your filters.' : 'No events in this period.'}
            </p>
          )}
        </div>

        <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <p className="text-caption text-muted-foreground">
            {pagination?.total ? `Showing ${from}–${to} of ${formatInt(pagination.total)} ${filtering ? 'filtered ' : ''}events` : ''}
          </p>
          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onChange={(p) => setParams({ page: String(p) }, { keepPage: true })}
            />
          )}
        </div>
      </section>

      <AuditLogDrawer log={selected} recordLink={recordLink} onClose={() => setSelected(null)} />
    </>
  )
}
