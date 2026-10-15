import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SearchIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import FilterSelect from '@/components/admin/FilterSelect'
import Pagination from '@/components/admin/Pagination'
import StatCard from '@/components/admin/StatCard'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { useDebounced } from '@/hooks/useDebounced'
import { DATE_RANGES } from '@/lib/adminUsers'
import { formatDateTime24, formatDuration, formatInt } from '@/lib/format'
import { ADMIN_TICKET_STATUS, CATEGORY_LABEL, SUPPORT_CATEGORIES, TICKET_PRIORITY } from '@/lib/support'
import { cn } from '@/lib/utils'
import { getSupportStats, listSupportAgents, listSupportTickets } from '@/services/admin.service'
import SupportAnalytics from './SupportAnalytics'

const FILTER_KEYS = ['q', 'status', 'category', 'days', 'assignee', 'scope', 'priority']
const th = 'border-y border-divider bg-muted px-3 py-[12.5px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-3 py-[16.25px] text-caption whitespace-nowrap'
const toOptions = (map) => Object.entries(map).map(([value, s]) => ({ value, label: s.label }))
const SCOPE_OPTIONS = [
  { value: 'mine', label: 'Assigned to Me' },
  { value: 'unassigned', label: 'Unassigned' },
]
const selectClass = 'h-[42.5px] w-full rounded-lg bg-card text-caption text-foreground'

export default function TicketInbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? '']))
  const page = Number(searchParams.get('page')) || 1
  const [search, setSearch] = useState(filters.q)
  const debouncedSearch = useDebounced(search.trim())

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
    () => Object.fromEntries(Object.entries({ ...filters, page, limit: 10 }).filter(([, v]) => v !== '')),
    [searchParams.toString(), page], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const { data, loading } = useAsync(() => listSupportTickets(query), [query])
  const { data: stats } = useAsync(getSupportStats, [])
  const { data: agents } = useAsync(() => listSupportAgents().then((r) => r.data), [])
  const tickets = data?.data ?? []
  const pagination = data?.pagination

  const from = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0
  const to = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0
  const filtering = FILTER_KEYS.some((k) => filters[k])

  const cards = [
    { label: 'Open Tickets', value: stats?.open, onClick: () => setParams({ status: '' }) },
    { label: 'New', value: stats?.new, onClick: () => setParams({ status: 'received' }) },
    { label: 'In Progress', value: stats?.inProgress, onClick: () => setParams({ status: 'in_progress' }) },
    { label: 'Waiting for User', value: stats?.waiting, onClick: () => setParams({ status: 'waiting_for_user' }) },
    { label: 'Resolved Today', value: stats?.resolvedToday, onClick: () => setParams({ status: 'resolved' }) },
  ]

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value != null ? formatInt(c.value) : null} onClick={c.onClick} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-divider bg-card px-[15px] py-2.5 text-caption">
        <p className="text-muted-foreground">
          Average First Response <b className="ml-2 text-foreground">{formatDuration(stats?.avgFirstResponseMs)}</b>
        </p>
        <p className="text-muted-foreground">
          Average Resolution Time <b className="ml-2 text-foreground">{formatDuration(stats?.avgResolutionMs)}</b>
        </p>
        <p className="text-subtle sm:ml-auto">Last {stats?.metricsDays ?? 30} days</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[2fr_repeat(6,minmax(0,1fr))_auto]">
        <label className="flex h-[42.5px] items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30 sm:col-span-2 2xl:col-span-1">
          <SearchIcon className="size-5 shrink-0 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Ticket ID, investor, transaction ID or subject"
            className="min-w-0 flex-1 bg-transparent text-caption outline-none placeholder:text-subtle"
            aria-label="Search tickets"
          />
        </label>
        <FilterSelect
          label="Status"
          allLabel="All Statuses"
          options={toOptions(ADMIN_TICKET_STATUS)}
          value={filters.status}
          onChange={(v) => setParams({ status: v })}
          className={selectClass}
        />
        <FilterSelect
          label="Issue type"
          allLabel="All Issue Types"
          options={SUPPORT_CATEGORIES}
          value={filters.category}
          onChange={(v) => setParams({ category: v })}
          className={selectClass}
        />
        <FilterSelect
          label="Date range"
          allLabel="All Dates"
          options={DATE_RANGES}
          value={filters.days}
          onChange={(v) => setParams({ days: v })}
          className={selectClass}
        />
        <FilterSelect
          label="Agent"
          allLabel="All Agents"
          options={(agents ?? []).map((a) => ({ value: a.id, label: a.fullName }))}
          value={filters.assignee}
          onChange={(v) => setParams({ assignee: v })}
          className={selectClass}
        />
        <FilterSelect
          label="Assignment"
          allLabel="All Tickets"
          options={SCOPE_OPTIONS}
          value={filters.scope}
          onChange={(v) => setParams({ scope: v })}
          className={selectClass}
        />
        <FilterSelect
          label="Priority"
          allLabel="All Priorities"
          options={toOptions(TICKET_PRIORITY)}
          value={filters.priority}
          onChange={(v) => setParams({ priority: v })}
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

      <section className="overflow-hidden rounded-xl border bg-card shadow-[0_1.25px_2.5px_rgb(0_0_0/0.04)]">
        <div className={cn('overflow-x-auto pt-5 transition-opacity', loading && data && 'opacity-50')}>
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} pl-[25px]`}>Ticket ID</th>
                <th className={th}>Investor</th>
                <th className={th}>Subject</th>
                <th className={th}>Issue Type</th>
                <th className={th}>Related Transaction</th>
                <th className={th}>Created</th>
                <th className={th}>Status</th>
                <th className={th}>Assigned To</th>
                <th className={th}>Priority</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const status = ADMIN_TICKET_STATUS[t.status]
                const priority = TICKET_PRIORITY[t.priority]
                return (
                  <tr key={t.id} className="transition-colors hover:bg-muted/40">
                    <td className={`${td} pl-[25px] font-semibold`}>{t.ticketCode}</td>
                    <td className={td}>
                      <p className="font-semibold">{t.user?.fullName ?? 'Deleted user'}</p>
                      <p className="pt-[3.75px] text-muted-foreground">{t.user?.referralCode ?? '—'}</p>
                    </td>
                    <td className={cn(td, 'min-w-[170px] font-semibold whitespace-normal')}>
                      <span className="line-clamp-2" title={t.subject}>
                        {t.subject}
                      </span>
                    </td>
                    <td className={cn(td, 'min-w-[110px] whitespace-normal text-muted-foreground')}>{CATEGORY_LABEL[t.category]}</td>
                    <td className={`${td} text-muted-foreground`}>{t.relatedTransaction ?? '—'}</td>
                    <td className={`${td} text-muted-foreground`}>{formatDateTime24(t.createdAt)}</td>
                    <td className={td}>
                      <StatusBadge tone={status?.tone} icon={false}>
                        {status?.label ?? t.status}
                      </StatusBadge>
                    </td>
                    <td className={`${td} text-muted-foreground`}>{t.assignedTo?.fullName ?? <span className="text-subtle">Unassigned</span>}</td>
                    <td className={td}>
                      <StatusBadge tone={priority?.tone} icon={false}>
                        {priority?.label ?? t.priority}
                      </StatusBadge>
                    </td>
                    <td className={td}>
                      <Link
                        to={`/admin/support/tickets/${t.id}`}
                        className="inline-flex h-[35px] items-center rounded-lg border bg-card px-2.5 text-title font-bold transition-colors hover:bg-muted"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!data && <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}
          {data && !tickets.length && (
            <p className="py-12 text-center text-title text-muted-foreground">
              {filtering ? 'No tickets match your filters.' : 'No support tickets yet.'}
            </p>
          )}
        </div>

        <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <p className="text-caption text-muted-foreground">
            {pagination?.total ? `Showing ${from}–${to} of ${formatInt(pagination.total)} tickets` : ''}
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

      <div className="pt-[5px]">
        <SupportAnalytics stats={stats} />
      </div>
    </div>
  )
}
