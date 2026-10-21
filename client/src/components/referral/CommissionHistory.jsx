import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLineIcon, CopyIcon, MoreHorizontalIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import FilterSelect from '@/components/admin/FilterSelect'
import Pagination from '@/components/admin/Pagination'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import { useAsync } from '@/hooks/useAsync'
import { useDebounced } from '@/hooks/useDebounced'
import { DATE_RANGES } from '@/lib/adminUsers'
import { formatInt, formatUsdt, formatShares, formatDateTime24 } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportCommissions, listCommissions } from '@/services/referral.service'

const th = 'border-y border-divider bg-muted px-[15px] py-[12.5px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-[15px] py-[16.25px] text-caption whitespace-nowrap text-muted-foreground'

export default function CommissionHistory() {
  const [search, setSearch] = useState('')
  const [days, setDays] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const q = useDebounced(search.trim())

  useEffect(() => setPage(1), [q, days])
  const params = useMemo(() => ({ ...(q && { q }), ...(days && { days }), page, limit: 10 }), [q, days, page])
  const { data, loading } = useAsync(() => listCommissions(params), [params])
  const rows = data?.data ?? []
  const pagination = data?.pagination

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportCommissions({ ...(q && { q }), ...(days && { days }) })
    } catch (err) {
      toast.error(err.message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const copy = async (code) => {
    await navigator.clipboard.writeText(code)
    toast.success('Transaction ID copied')
  }

  const from = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0
  const to = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0

  return (
    <Panel className="px-0 pb-2.5">
      <PanelHeader
        className="px-[25px]"
        title="Commission History"
        description="Detailed record of your commission activity"
        action={
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !pagination?.total}
            className="flex min-h-[50px] items-center gap-3 text-title font-bold text-primary hover:underline disabled:text-subtle disabled:no-underline"
          >
            Export
            {exporting ? <Spinner className="size-5" /> : <ArrowDownToLineIcon className="size-[22.5px]" />}
          </button>
        }
      />

      <div className="mt-[18.75px] flex flex-wrap items-center justify-between gap-2.5 border-t border-divider bg-muted px-[25px] py-[12.5px]">
        <label className="flex h-[42.5px] w-full items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30 sm:w-[262.5px]">
          <SearchIcon className="size-5 shrink-0 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Transaction ID"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
            aria-label="Search transaction ID"
          />
        </label>
        <div className="w-full sm:w-[180px]">
          <FilterSelect label="Date range" allLabel="All Dates" options={DATE_RANGES} value={days} onChange={setDays} />
        </div>
      </div>

      <div className={cn('relative overflow-x-auto transition-opacity', loading && data && 'opacity-50')}>
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <th className={`${th} pl-[25px]`}>Date</th>
              <th className={th}>Member</th>
              <th className={th}>Original Transaction</th>
              <th className={th}>Level</th>
              <th className={th}>Commission Rate</th>
              <th className={th}>Commission</th>
              <th className={th}>Shares Purchased</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-muted/40">
                <td className={`${td} pl-[25px]`}>{formatDateTime24(c.date)}</td>
                <td className={`${td} font-semibold text-foreground`}>{c.member}</td>
                <td className={`${td} font-semibold text-foreground`}>{c.orderCode}</td>
                <td className={td}>
                  <span className="inline-flex h-[27.5px] min-w-[35px] items-center justify-center rounded-[6.25px] bg-primary-soft px-2 font-bold text-primary">
                    F{c.level}
                  </span>
                </td>
                <td className={td}>{c.ratePct}%</td>
                <td className={`${td} font-semibold text-foreground tabular-nums`}>
                  {formatUsdt(c.amount)} USDT
                  {c.status === 'pending' && (
                    <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning" title={`Released once ${c.member}’s face scan is approved`}>
                      Pending
                    </span>
                  )}
                </td>
                <td className={td}>
                  {formatShares(c.shares)} Class {c.shareType}
                </td>
                <td className={`${td} w-[88px]`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.orderCode}`} />}>
                      <MoreHorizontalIcon className="size-[25px] text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => copy(c.orderCode)}>
                        <CopyIcon />
                        Copy transaction ID
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data && <Spinner className="mx-auto my-12 size-6 text-muted-foreground" />}
        {data && !rows.length && (
          <p className="py-12 text-center text-caption text-muted-foreground">
            {q || days ? 'No commissions match your filters.' : 'No commissions yet. You’ll earn when your direct referrals complete a purchase.'}
          </p>
        )}
      </div>

      <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 px-[25px]">
        <p className="text-caption text-muted-foreground">{pagination?.total ? `Showing ${from}–${to} of ${formatInt(pagination.total)}` : ''}</p>
        {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />}
      </div>
    </Panel>
  )
}
