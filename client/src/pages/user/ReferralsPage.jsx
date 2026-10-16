import { Spinner } from '@/components/ui/spinner'
import PageHeader from '@/components/PageHeader'
import CommissionWallet from '@/components/referral/CommissionWallet'
import CommissionHistory from '@/components/referral/CommissionHistory'
import CommissionMechanism from '@/components/referral/CommissionMechanism'
import CommissionPerformance from '@/components/referral/CommissionPerformance'
import NetworkOverview from '@/components/referral/NetworkOverview'
import ReferralKpis from '@/components/referral/ReferralKpis'
import ReferralLinkCard from '@/components/referral/ReferralLinkCard'
import ReferralNetwork from '@/components/referral/ReferralNetwork'
import { useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getReferralNetwork, getReferralSummary } from '@/services/referral.service'

export default function ReferralsPage() {
  const [reloadKey, setReloadKey] = useState(0)
  const { data: summary, error } = useAsync(getReferralSummary, [reloadKey])
  const { data: network } = useAsync(getReferralNetwork, [])

  return (
    <>
      <PageHeader
        breadcrumb={['Investor Portal', 'Referral & Commission']}
        title="Referral & Commission"
        description="Track your referral network and the commission you’ve earned."
      />

      {error && <p className="text-destructive">Couldn’t load your referral data. Please try again.</p>}
      {!summary && !error && (
        <div className="flex justify-center py-20">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      )}

      {summary && (
        <div className="flex flex-col gap-[17.5px]">
          <ReferralLinkCard code={summary.referralCode} />
          <CommissionWallet onChanged={() => setReloadKey((k) => k + 1)} />
          <ReferralKpis summary={summary} />
          <NetworkOverview network={summary.network} />
          {network ? (
            <ReferralNetwork rootName={network.root.name} members={network.members} />
          ) : (
            <Spinner className="mx-auto my-10 size-6 text-muted-foreground" />
          )}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-[17.5px] xl:grid-cols-[minmax(0,1fr)_368.75px]">
            <CommissionPerformance />
            <CommissionMechanism ratePct={summary.commission.ratePct} />
          </div>
          <CommissionHistory />
        </div>
      )}
    </>
  )
}
