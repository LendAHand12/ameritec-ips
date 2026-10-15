import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { CheckIcon, ClockIcon, FileWarningIcon, ReceiptIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import FilterSelect from '@/components/admin/FilterSelect'
import OrderReviewDialog from '@/components/admin/OrderReviewDialog'
import Pagination from '@/components/admin/Pagination'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatInt, formatUsdt } from '@/lib/format'
import { ORDER_STATUS, PAYMENT_METHOD_LABEL } from '@/lib/orders'
import { cn } from '@/lib/utils'
import { getOrderStats, listAdminOrders } from '@/services/admin.service'

const FILTER_KEYS = ['q', 'status', 'paymentMethod', 'shareType']
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

export default function AdminTransactionsPage() {
  const { refreshStats } = useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? '']))
  const page = Number(searchParams.get('page')) || 1
  const [search, setSearch] = useState(filters.q)
  const debouncedSearch = useDebounced(search.trim())
  const [reviewId, setReviewId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

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
  const { data, loading } = useAsync(() => listAdminOrders(query), [query, reloadKey])
  const { data: stats } = useAsync(() => getOrderStats().then((r) => r.data), [reloadKey])
  const orders = data?.data ?? []
  const pagination = data?.pagination

  const onChanged = useCallback(() => {
    setReloadKey((k) => k + 1)
    refreshStats()
  }, [refreshStats])
  const closeReview = useCallback(() => setReviewId(null), [])

  const kpis = [
    { label: 'Pending Review', value: stats?.pendingReview, icon: ClockIcon, onClick: () => setParams({ status: 'pending_review' }) },
    { label: 'Completed', value: stats?.completed, icon: CheckIcon, onClick: () => setParams({ status: 'completed' }) },
    { label: 'Missing Certificates', value: stats?.missingCertificates, icon: FileWarningIcon },
    { label: 'Revenue (USDT)', value: stats && formatUsdt(stats.revenue), icon: ReceiptIcon },
  ]

  return (
    <>
      <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Transactions</h1>
      <p className="pt-[6.25px] text-title text-muted-foreground">Confirm share purchases and issue certificates.</p>

      <div className="mt-[18.75px] grid grid-cols-2 gap-[11.25px] xl:grid-cols-4">
        {kpis.map(({ label, value, icon, onClick }) => {
          const Icon = icon
          const Tag = onClick ? 'button' : 'div'
          return (
            <Tag
              key={label}
              type={onClick ? 'button' : undefined}
              onClick={onClick}
              className={cn(
                'flex items-center gap-[12.5px] rounded-lg border bg-card px-3 py-[15px] text-left shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)] sm:px-[17.5px]',
                onClick && 'transition-colors hover:border-primary/50',
              )}
            >
              <span className="flex size-[37.5px] items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
                <Icon className="size-[21.25px]" />
              </span>
              <span className="space-y-[5px]">
                <span className="block text-caption text-muted-foreground">{label}</span>
                <span className="block text-title font-bold tabular-nums">{value ?? '—'}</span>
              </span>
            </Tag>
          )
        })}
      </div>

      <section className="mt-[12.5px] overflow-hidden rounded-[11.25px] border bg-card shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
        <div className="flex flex-wrap items-center gap-[8.75px] border-b border-divider bg-muted px-[18.75px] py-[13.75px]">
          <label className="flex h-[42.5px] w-full items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30 lg:w-[300px]">
            <SearchIcon className="size-5 shrink-0 text-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order, investor, tx hash"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              aria-label="Search orders"
            />
          </label>
          <div className="grid w-full grid-cols-1 gap-[8.75px] sm:grid-cols-3 lg:w-auto lg:flex-1">
            <FilterSelect
              label="Status"
              allLabel="All Statuses"
              options={Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label }))}
              value={filters.status}
              onChange={(v) => setParams({ status: v })}
            />
            <FilterSelect
              label="Payment method"
              allLabel="All Methods"
              options={Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))}
              value={filters.paymentMethod}
              onChange={(v) => setParams({ paymentMethod: v })}
            />
            <FilterSelect
              label="Class"
              allLabel="All Classes"
              options={[
                { value: 'A', label: 'Class A' },
                { value: 'B', label: 'Class B' },
              ]}
              value={filters.shareType}
              onChange={(v) => setParams({ shareType: v })}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))
            }}
            className="h-[42.5px] px-3 text-title font-semibold whitespace-nowrap text-primary hover:underline"
          >
            Reset Filters
          </button>
        </div>

        <div className={cn('overflow-x-auto transition-opacity', loading && data && 'opacity-50')}>
          <table className="w-full min-w-[1050px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} pl-5`}>Order</th>
                <th className={th}>Investor</th>
                <th className={th}>Class</th>
                <th className={th}>Amount</th>
                <th className={th}>Method</th>
                <th className={th}>Status</th>
                <th className={th}>Certificate</th>
                <th className={th}>Created</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const status = ORDER_STATUS[o.status]
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/40">
                    <td className={`${td} pl-5 text-title font-semibold`}>{o.orderCode}</td>
                    <td className={td}>
                      <p className="text-title font-semibold">{o.user?.fullName}</p>
                      <p className="text-caption text-muted-foreground">{o.user?.email}</p>
                    </td>
                    <td className={td}>
                      <p className="flex items-center gap-2 text-title">
                        <ShareSwatch type={o.shareType} />
                        Class {o.shareType}
                      </p>
                      <p className="text-caption text-muted-foreground">{formatInt(o.shares)} shares</p>
                    </td>
                    <td className={`${td} text-title font-semibold tabular-nums`}>{formatUsdt(o.amount)}</td>
                    <td className={`${td} text-title text-muted-foreground`}>{o.paymentMethod ? PAYMENT_METHOD_LABEL[o.paymentMethod] : '—'}</td>
                    <td className={td}>
                      <StatusBadge tone={status.tone} icon={false}>
                        {status.label}
                      </StatusBadge>
                    </td>
                    <td className={`${td} text-caption`}>
                      {o.status !== 'completed' ? (
                        <span className="text-subtle">—</span>
                      ) : o.certificate ? (
                        <span className="text-success">Issued</span>
                      ) : (
                        <span className="font-semibold text-warning">Missing</span>
                      )}
                    </td>
                    <td className={`${td} text-title text-muted-foreground`}>{formatDate(o.createdAt)}</td>
                    <td className={td}>
                      <Button variant="outline" className="h-[35px] rounded-lg px-[11.25px] text-title font-bold" onClick={() => setReviewId(o.id)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!data && <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}
          {data && !orders.length && <p className="py-12 text-center text-title text-muted-foreground">No orders match your filters.</p>}
        </div>

        <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p className="text-title text-muted-foreground">{pagination?.total ? `${formatInt(pagination.total)} orders` : ''}</p>
          {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={(p) => setParams({ page: String(p) }, { keepPage: true })} />}
        </div>
      </section>

      <OrderReviewDialog orderId={reviewId} onClose={closeReview} onChanged={onChanged} />
    </>
  )
}
