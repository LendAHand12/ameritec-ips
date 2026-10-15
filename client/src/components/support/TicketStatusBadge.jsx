import StatusBadge from '@/components/dashboard/StatusBadge'
import { TICKET_STATUS } from '@/lib/support'

export function TicketStatusBadge({ status }) {
  const s = TICKET_STATUS[status]
  return (
    <StatusBadge tone={s?.tone} icon={false}>
      {s?.label ?? status}
    </StatusBadge>
  )
}
