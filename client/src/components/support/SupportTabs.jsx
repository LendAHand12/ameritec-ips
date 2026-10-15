import { SUPPORT_TABS } from '@/lib/support'
import { cn } from '@/lib/utils'

/** Numbered three-step tab bar of the Support Center. */
export default function SupportTabs({ value, onChange }) {
  return (
    <div role="tablist" aria-label="Support" className="grid grid-cols-3 gap-[5px] rounded-lg border bg-card p-[5px]">
      {SUPPORT_TABS.map((tab, i) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`support-tab-${tab.value}`}
            aria-selected={active}
            aria-controls={`support-panel-${tab.value}`}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex min-h-[47.5px] flex-col items-center justify-center gap-x-[8.75px] gap-y-1 rounded-[7.5px] px-2 py-1.5 text-caption transition-colors sm:flex-row',
              active ? 'bg-primary-soft font-bold text-foreground' : 'font-semibold text-muted-foreground hover:bg-muted',
            )}
          >
            <span
              className={cn(
                'flex size-[22.5px] shrink-0 items-center justify-center rounded-full',
                active ? 'bg-primary font-bold text-white' : 'bg-muted text-subtle',
              )}
            >
              {i + 1}
            </span>
            <span className="text-center">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
