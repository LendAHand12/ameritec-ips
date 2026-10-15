import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import FindSolution from '@/components/support/FindSolution'
import MyRequests from '@/components/support/MyRequests'
import SubmitRequest from '@/components/support/SubmitRequest'
import SupportTabs from '@/components/support/SupportTabs'
import { SUPPORT_TABS } from '@/lib/support'

export function SupportAvailable() {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-success/15 bg-success-soft px-[13.75px] py-2.5">
      <span className="size-[8.75px] rounded-full bg-success shadow-[0_0_0_3.75px_rgb(22_130_93/0.12)]" aria-hidden />
      <span className="space-y-[2.5px]">
        <span className="block text-caption font-bold text-success">Support available</span>
        <span className="block text-caption text-muted-foreground">We’re here to help</span>
      </span>
    </div>
  )
}

export default function SupportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = SUPPORT_TABS.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'solutions'
  // Article the investor came from ("Still need help?") — prefills the request form
  const [prefill, setPrefill] = useState(null)

  const goTo = (value) => setSearchParams(value === 'solutions' ? {} : { tab: value })

  return (
    <>
      <PageHeader
        breadcrumb={['Investor Portal', 'Support']}
        title="Support Center"
        description="Find solutions, report an issue, or track your support requests."
        action={<SupportAvailable />}
      />

      <SupportTabs value={tab} onChange={goTo} />

      <div role="tabpanel" id={`support-panel-${tab}`} aria-labelledby={`support-tab-${tab}`} className="pt-[17.5px]">
        {tab === 'solutions' && (
          <FindSolution
            onRequest={(article) => {
              setPrefill({ ...(article.category && { category: article.category }), ...(article.code && { errorCode: article.code }) })
              goTo('new')
            }}
          />
        )}
        {tab === 'new' && (
          <SubmitRequest
            key={JSON.stringify(prefill)}
            prefill={prefill}
            onBack={() => goTo('solutions')}
            onCreated={(ticket) => setSearchParams({ tab: 'requests', ticket: ticket.id })}
          />
        )}
        {tab === 'requests' && <MyRequests />}
      </div>
    </>
  )
}
