import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRightIcon, BellIcon, CheckIcon, CircleHelpIcon, SearchIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import FilterSelect from '@/components/admin/FilterSelect'
import Pagination from '@/components/admin/Pagination'
import KpiCard, { KpiIcon } from '@/components/dashboard/KpiCard'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import { useAsync } from '@/hooks/useAsync'
import { useDebounced } from '@/hooks/useDebounced'
import { DATE_RANGES } from '@/lib/adminUsers'
import { formatInt, formatDateTime24 } from '@/lib/format'
import { CATEGORY_LABEL, SUPPORT_CATEGORIES, TICKET_STATUS } from '@/lib/support'
import { cn } from '@/lib/utils'
import { getTicketStats, listTickets } from '@/services/support.service'
import TicketDrawer from './TicketDrawer'
import { TicketStatusBadge } from './TicketStatusBadge'

const th = 'border-y border-divider bg-muted px-[15px] py-[12.5px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-[15px] py-[16.25px] text-caption whitespace-nowrap text-muted-foreground'
const STATUS_OPTIONS = Object.entries(TICKET_STATUS).map(([value, s]) => ({ value, label: s.label }))
const plural = (n) => (n === 1 ? 'Request' : 'Requests')

/** Tab 3: the investor's tickets with status counts. */
export default function MyRequests() {
  const [searchParams, setSearchParams] = useSearchParams()
  const openTicketId = searchParams.get('ticket')
  // Bumped after a reply so the table and counts pick up the new status
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [days, setDays] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search.trim())

  useEffect(() => setPage(1), [q, status, category, days])
  const params = useMemo(
    () => ({ ...(q && { q }), ...(status && { status }), ...(category && { category }), ...(days && { days }), page, limit: 10 }),
    [q, status, category, days, page],
  )
  const { data: stats } = useAsync(getTicketStats, [version])
  const { data, loading } = useAsync(() => listTickets(params), [params, version])

  const openTicket = (id) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id) next.set('ticket', id)
      else next.delete('ticket')
      return next
    })
  const rows = data?.data ?? []
  const pagination = data?.pagination
  const filtering = !!(q || status || category || days)

  return (
    <div className="space-y-[17.5px]">
      <div className="grid gap-[17.5px] md:grid-cols-3">
        <KpiCard
          label="Open Requests"
          value={formatInt(stats?.open ?? 0)}
          unit={plural(stats?.open)}
          icon={<KpiIcon icon={CircleHelpIcon} />}
          footer="Currently being reviewed"
        />
        <KpiCard
          label="Waiting for Response"
          value={formatInt(stats?.waiting ?? 0)}
          unit={plural(stats?.waiting)}
          icon={<KpiIcon icon={BellIcon} />}
          footer="Your response is needed"
        />
        <KpiCard
          label="Resolved"
          value={formatInt(stats?.resolved ?? 0)}
          unit={plural(stats?.resolved)}
          icon={<KpiIcon icon={CheckIcon} />}
          footer="All-time resolved"
        />
      </div>

      <Panel className="px-0 pb-2.5">
        <PanelHeader className="px-[25px]" title="My Requests" description="Track and manage your support requests" />

        <div className="mt-[17.5px] flex flex-wrap items-center gap-2.5 border-t border-divider bg-muted px-[25px] py-[12.5px]">
          <label className="flex h-[42.5px] w-full items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30 sm:w-[262.5px]">
            <SearchIcon className="size-5 shrink-0 text-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticket ID or keyword"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              aria-label="Search requests"
            />
          </label>
          <div className="grid w-full grid-cols-1 gap-2.5 sm:ml-auto sm:flex sm:w-auto">
            <div className="sm:w-[151.25px]">
              <FilterSelect label="Status" allLabel="All Statuses" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            </div>
            <div className="sm:w-[191.25px]">
              <FilterSelect label="Category" allLabel="All Categories" options={SUPPORT_CATEGORIES} value={category} onChange={setCategory} />
            </div>
            <div className="sm:w-[145px]">
              <FilterSelect label="Date range" allLabel="All Dates" options={DATE_RANGES} value={days} onChange={setDays} />
            </div>
          </div>
        </div>

        <div className={cn('relative overflow-x-auto transition-opacity', loading && data && 'opacity-50')}>
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} pl-[25px]`}>Ticket ID</th>
                <th className={th}>Subject</th>
                <th className={th}>Category</th>
                <th className={th}>Created</th>
                <th className={th}>Last Updated</th>
                <th className={th}>Status</th>
                <th className={th}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} onClick={() => openTicket(t.id)} className="cursor-pointer transition-colors hover:bg-muted/40">
                  <td className={`${td} pl-[25px] font-semibold text-foreground`}>{t.ticketCode}</td>
                  <td className={`${td} max-w-[360px] truncate font-semibold text-foreground`}>{t.subject}</td>
                  <td className={td}>{CATEGORY_LABEL[t.category]}</td>
                  <td className={td}>{formatDateTime24(t.createdAt)}</td>
                  <td className={td}>{formatDateTime24(t.lastActivityAt)}</td>
                  <td className={td}>
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td className={`${td} w-[77.5px]`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openTicket(t.id)
                      }}
                      aria-label={`Open ${t.ticketCode}`}
                      className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
                    >
                      <ArrowRightIcon className="size-[18.75px] text-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && <Spinner className="mx-auto my-12 size-6 text-muted-foreground" />}
          {data && !rows.length && (
            <p className="py-12 text-center text-caption text-muted-foreground">
              {filtering ? 'No requests match your filters.' : 'You haven’t submitted any support requests yet.'}
            </p>
          )}
        </div>

        {pagination?.totalPages > 1 && (
          <div className="flex min-h-[60px] items-center justify-end px-[25px]">
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />
          </div>
        )}
      </Panel>

      <TicketDrawer ticketId={openTicketId} onClose={() => openTicket(null)} onUpdated={() => setVersion((v) => v + 1)} />
    </div>
  )
}
