import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/admin/Pagination'
import { Panel } from '@/components/dashboard/Panel'
import OrdersTable from '@/components/trade/OrdersTable'
import { useAsync } from '@/hooks/useAsync'
import { formatInt } from '@/lib/format'
import { listOrders } from '@/services/trade.service'

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(() => listOrders({ page, limit: 10 }), [page])

  return (
    <>
      <PageHeader
        breadcrumb={['Investor Portal', 'Trade', 'Transactions']}
        title="Transactions"
        description="All your Pre-IPO share purchases."
        action={
          <Link to="/trade" className={buttonVariants({ className: 'h-[50px] gap-3 px-[21.25px] text-title font-bold' })}>
            Buy Shares
            <ArrowRightIcon className="size-[22.5px]" />
          </Link>
        }
      />
      <Panel className="px-0 pt-0 pb-[7.5px]">
        <div className={loading && data ? 'opacity-50 transition-opacity' : ''}>
          {data ? <OrdersTable orders={data.data} /> : <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}
        </div>
        {data?.pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-[25px] pt-4 pb-2">
            <p className="text-caption text-muted-foreground">{formatInt(data.pagination.total)} transactions</p>
            <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
          </div>
        )}
      </Panel>
    </>
  )
}
