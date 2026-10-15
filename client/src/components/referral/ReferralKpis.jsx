import { ShoppingBagIcon, UsersIcon, WalletIcon } from 'lucide-react'
import KpiCard, { KpiIcon } from '@/components/dashboard/KpiCard'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import { formatClassRates, formatInt, formatUsdt } from '@/lib/format'

export default function ReferralKpis({ summary }) {
  const { network, commission, referralShares } = summary
  return (
    <div className="grid gap-[17.5px] md:grid-cols-3">
      <KpiCard
        label="Total Network Members"
        value={formatInt(network.total)}
        unit="Members"
        icon={<KpiIcon icon={UsersIcon} />}
        footer={<span className="font-semibold text-success">+{formatInt(network.newThisMonth)} this month</span>}
      />
      <KpiCard
        label="Total Commission"
        value={formatUsdt(commission.total)}
        unit="USDT"
        icon={<KpiIcon icon={WalletIcon} />}
        footer={`${formatClassRates(commission.ratePct)} of your direct referrals’ purchases · credited to your balance`}
      />
      <KpiCard
        label="Shares Bought by Your Referrals"
        value={formatInt(referralShares.total)}
        unit="Shares"
        icon={<KpiIcon icon={ShoppingBagIcon} />}
        footer={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {['A', 'B'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <ShareSwatch type={t} className="size-[8.75px] rounded-[2.5px]" />
                Class {t}: {formatInt(referralShares[t])}
              </span>
            ))}
          </span>
        }
      />
    </div>
  )
}
