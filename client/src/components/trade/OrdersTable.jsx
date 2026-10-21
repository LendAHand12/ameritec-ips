import { Link } from 'react-router-dom'
import { DownloadIcon, MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatUsdt, formatShares, formatDateTime24 } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/orders'
import { certificateUrl } from '@/services/trade.service'

const th = 'border-y border-divider bg-muted px-[15px] py-[12.5px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-[15px] py-[16.25px] text-caption whitespace-nowrap text-muted-foreground'

function RowActions({ order }) {
  const needsPayment = order.status === 'awaiting_payment' || order.status === 'paying'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${order.orderCode}`} />}>
        <MoreHorizontalIcon className="size-[25px] text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link to={`/trade/orders/${order.id}`} />}>{needsPayment ? 'Complete payment' : 'View details'}</DropdownMenuItem>
        {order.hasCertificate && (
          <DropdownMenuItem render={<a href={certificateUrl(order.id)} />}>
            <DownloadIcon />
            Download certificate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Share purchases table used on the dashboard, the trade page and the orders list. */
export default function OrdersTable({ orders, emptyText = 'No transactions yet.' }) {
  if (!orders.length) return <p className="py-10 text-center text-caption text-muted-foreground">{emptyText}</p>
  return (
    // relative: keeps absolutely positioned bits (sr-only header text) inside the scroll area
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr>
            <th className={`${th} pl-[25px]`}>Date</th>
            <th className={th}>Transaction ID</th>
            <th className={th}>Class</th>
            <th className={th}>USDT amount</th>
            <th className={th}>Share quantity</th>
            <th className={th}>Purchase price</th>
            <th className={th}>Status</th>
            <th className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const status = ORDER_STATUS[o.status]
            return (
              <tr key={o.id} className="transition-colors hover:bg-muted/40">
                <td className={`${td} pl-[25px]`}>{formatDateTime24(o.createdAt)}</td>
                <td className={`${td} font-semibold text-foreground`}>
                  <Link to={`/trade/orders/${o.id}`} className="hover:underline">
                    {o.orderCode}
                  </Link>
                </td>
                <td className={td}>
                  <span className="flex items-center gap-2.5">
                    <ShareSwatch type={o.shareType} />
                    Class {o.shareType}
                  </span>
                </td>
                <td className={td}>
                  <span className="font-semibold text-foreground tabular-nums">{formatUsdt(o.amount)}</span> USDT
                </td>
                <td className={`${td} tabular-nums`}>{formatShares(o.shares)}</td>
                <td className={`${td} tabular-nums`}>{formatUsdt(o.price)} USDT</td>
                <td className={td}>
                  <StatusBadge tone={status.tone} icon={o.status === 'completed'}>
                    {status.label}
                  </StatusBadge>
                </td>
                <td className={`${td} w-[94px]`}>
                  <RowActions order={o} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
