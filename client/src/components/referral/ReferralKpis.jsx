import { BarChart3Icon, ShoppingBagIcon, UsersIcon, WalletIcon } from 'lucide-react'
import KpiCard, { KpiIcon } from '@/components/dashboard/KpiCard'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import { formatClassRates, formatInt, formatUsdt, formatShares } from '@/lib/format'

export default function ReferralKpis({ summary }) {
  const { network, commission, referralShares, teamSales } = summary
  return (
    <div className="grid gap-[17.5px] md:grid-cols-2 xl:grid-cols-4">
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
        footer={
          commission.pending > 0 ? (
            <span className="font-semibold text-warning">
              {formatUsdt(commission.pending)} USDT pending — released once your referrals finish verification
            </span>
          ) : (
            `${formatClassRates(commission.ratePct)} of your direct referrals’ purchases · credited to your balance`
          )
        }
      />
      <KpiCard
        label="Network Sales"
        value={formatUsdt(teamSales.total)}
        unit="USDT"
        icon={<KpiIcon icon={BarChart3Icon} />}
        footer={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>F1 {formatUsdt(teamSales.f1)}</span>
            <span>F2 {formatUsdt(teamSales.f2)}</span>
            <span>F3 {formatUsdt(teamSales.f3)}</span>
            {teamSales.deeper > 0 && <span>F4+ {formatUsdt(teamSales.deeper)}</span>}
          </span>
        }
      />
      <KpiCard
        label="Shares Bought by Your Referrals"
        value={formatShares(referralShares.total)}
        unit="Shares"
        icon={<KpiIcon icon={ShoppingBagIcon} />}
        footer={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {['A', 'B'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <ShareSwatch type={t} className="size-[8.75px] rounded-[2.5px]" />
                Class {t}: {formatShares(referralShares[t])}
              </span>
            ))}
          </span>
        }
      />
    </div>
  )
}
