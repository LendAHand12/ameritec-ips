import { Link } from 'react-router-dom'
import { ArrowRightIcon, TrendingDownIcon, TrendingUpIcon, WalletIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import PageHeader from '@/components/PageHeader'
import AccountStatusCard from '@/components/dashboard/AccountStatusCard'
import KpiCard, { KpiIcon } from '@/components/dashboard/KpiCard'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import PerformanceChart from '@/components/dashboard/PerformanceChart'
import PreIpoInfoBar from '@/components/dashboard/PreIpoInfoBar'
import { ShareRing } from '@/components/dashboard/ShareMarker'
import OrdersTable from '@/components/trade/OrdersTable'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { formatPercent, formatUsdt, formatShares } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getPortfolio } from '@/services/trade.service'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, error } = useAsync(getPortfolio, [])

  const gainPct = data?.totalInvested ? ((data.totalValue - data.totalInvested) / data.totalInvested) * 100 : null
  const up = (gainPct ?? 0) >= 0
  const TrendIcon = up ? TrendingUpIcon : TrendingDownIcon

  return (
    <>
      <PageHeader
        breadcrumb={['Investor Portal', 'Dashboard']}
        title={`Welcome back, ${user.fullName}`}
        description="Here’s an overview of your Pre-IPO portfolio."
        action={
          <Link to="/trade" className={buttonVariants({ className: 'h-[50px] gap-3 px-[21.25px] text-title font-bold' })}>
            Buy Shares
            <ArrowRightIcon className="size-[22.5px]" />
          </Link>
        }
      />

      {error && <p className="text-destructive">Couldn’t load your dashboard. Please try again.</p>}
      {!data && !error && (
        <div className="flex justify-center py-20">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-[17.5px]">
          <div className="grid gap-[17.5px] sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              highlight
              label="Total Portfolio Value"
              value={formatUsdt(data.totalValue)}
              unit="USDT"
              icon={<KpiIcon icon={TrendingUpIcon} />}
              footer={
                gainPct === null ? (
                  'No completed purchases yet'
                ) : (
                  <span className={cn('flex items-center gap-[5px] font-semibold', up ? 'text-success' : 'text-danger')}>
                    <TrendIcon className="size-[18.75px]" aria-hidden />
                    {formatPercent(gainPct)} vs. invested
                  </span>
                )
              }
            />
            <KpiCard
              label="Total Shares"
              value={formatShares(data.totalShares)}
              unit="Shares"
              icon={<KpiIcon icon={WalletIcon} />}
              footer={`Invested ${formatUsdt(data.totalInvested)} USDT`}
            />
            {data.shares.map((s) => (
              <KpiCard
                key={s.type}
                label={s.label}
                value={formatShares(s.quantity)}
                unit="Shares"
                icon={<ShareRing type={s.type} />}
                footer={`${formatUsdt(s.value)} USDT`}
              />
            ))}
          </div>

          <PreIpoInfoBar shares={data.shares} balance={data.balance} />

          <div className="grid gap-[17.5px] xl:grid-cols-[minmax(0,1fr)_368.75px]">
            <PerformanceChart portfolio={data} />
            <AccountStatusCard user={user} />
          </div>

          <Panel className="px-0 pb-[7.5px]">
            <PanelHeader
              className="px-[25px]"
              title="Recent transactions"
              description="Your latest share purchases"
              action={
                <Link to="/trade/orders" className="flex min-h-[50px] items-center gap-3 text-title font-bold text-primary hover:underline">
                  View all transactions
                  <ArrowRightIcon className="size-[22.5px]" />
                </Link>
              }
            />
            <div className="mt-5">
              <OrdersTable orders={data.recentOrders} emptyText="No purchases yet — buy your first shares on the Trade page." />
            </div>
          </Panel>
        </div>
      )}
    </>
  )
}
