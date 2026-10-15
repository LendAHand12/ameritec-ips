import { useSearchParams } from 'react-router-dom'
import ErrorCatalog from '@/components/admin/support/ErrorCatalog'
import TicketInbox from '@/components/admin/support/TicketInbox'
import { cn } from '@/lib/utils'

const TABS = [
  { value: 'inbox', label: 'Ticket Inbox' },
  { value: 'catalog', label: 'Error Catalog' },
]

export default function AdminSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'catalog' ? 'catalog' : 'inbox'

  return (
    <>
      <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Support</h1>
      <p className="pt-[6.25px] text-caption text-muted-foreground">
        Manage investor support requests, investigate reported issues, and maintain the support error catalog.
      </p>

      <div role="tablist" aria-label="Support sections" className="mt-5 flex gap-[30px] border-b">
        {TABS.map((t) => {
          const active = t.value === tab
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`admin-support-tab-${t.value}`}
              aria-selected={active}
              aria-controls={`admin-support-panel-${t.value}`}
              onClick={() => setSearchParams(t.value === 'inbox' ? {} : { tab: t.value })}
              className={cn(
                'h-[51.25px] p-2.5 text-title font-bold transition-colors',
                active ? 'text-foreground shadow-[inset_0_-2.5px_0_0_var(--primary)]' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`admin-support-panel-${tab}`} aria-labelledby={`admin-support-tab-${tab}`} className="pt-5">
        {tab === 'inbox' ? <TicketInbox /> : <ErrorCatalog />}
      </div>
    </>
  )
}
