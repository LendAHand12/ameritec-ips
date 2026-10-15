import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRightIcon, CalculatorIcon, CheckIcon, InfoIcon, ShieldCheckIcon, TrendingUpIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import PageHeader from '@/components/PageHeader'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import OrdersTable from '@/components/trade/OrdersTable'
import { useAsync } from '@/hooks/useAsync'
import { formatInt, formatUsdt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { createOrder, getTradeConfig, listOrders } from '@/services/trade.service'

const QUICK_AMOUNTS = [100, 500, 1000, 5000]

function SummaryRow({ label, children, strong }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-[8.75px] text-caption', strong && 'border-t pt-[15px]')}>
      <dt className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</dt>
      <dd className={cn('text-right font-semibold', strong && 'text-title')}>{children}</dd>
    </div>
  )
}

function ShareTypeCard({ share, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-[72.5px] items-center gap-2.5 rounded-lg border px-[15px] py-[12.5px] text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
        selected ? 'border-primary bg-primary-soft' : 'bg-card hover:border-primary/50',
      )}
    >
      <ShareSwatch type={share.type} />
      <span className="flex-1 space-y-[3.75px]">
        <span className="block text-title font-bold">{share.label}</span>
        <span className="block text-caption text-muted-foreground">
          {share.description} · {formatUsdt(share.price)} USDT / Share
        </span>
      </span>
      <span
        className={cn(
          'flex size-[22.5px] shrink-0 items-center justify-center rounded-full border',
          selected && 'border-primary bg-primary text-white',
        )}
      >
        {selected && <CheckIcon className="size-[16.25px]" />}
      </span>
    </button>
  )
}

export default function TradePage() {
  const navigate = useNavigate()
  const { data: config, error } = useAsync(getTradeConfig, [])
  const { data: orders } = useAsync(() => listOrders({ limit: 5 }), [])
  const [amountInput, setAmountInput] = useState('1000')
  const [shareType, setShareType] = useState('A')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const share = config?.shares.find((s) => s.type === shareType)
  const amount = Number(amountInput) || 0
  const priceCents = share ? Math.round(share.price * 100) : 0
  const shares = priceCents ? Math.floor(Math.round(amount * 100) / priceCents) : 0
  const total = (shares * priceCents) / 100
  const rounded = shares > 0 && Math.abs(total - amount) > 0.001
  const hasPaymentMethod = !!(config?.paymentMethods.bep20 || config?.paymentMethods.zelle)
  const minCents = Math.round((config?.minPurchase.amount ?? 0) * 100)
  const minLabel = config?.minPurchase.firstPurchase ? 'Minimum first purchase' : 'Minimum purchase'
  // Whole shares only, so the smallest valid payment can sit slightly above the minimum
  const minTotalCents = priceCents ? Math.max(1, Math.ceil(minCents / priceCents)) * priceCents : 0
  const belowMin = shares >= 1 && Math.round(total * 100) < minCents
  const amountError =
    !amountInput || !share
      ? ''
      : shares < 1
        ? `Minimum is 1 share (${formatUsdt(share.price)} USDT)`
        : belowMin
          ? `${minLabel} is ${formatUsdt(minCents / 100)} USDT${minTotalCents !== minCents ? ` — at least ${formatUsdt(minTotalCents / 100)} USDT for whole ${share.label} shares` : ''}`
          : ''

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const { order } = await createOrder({ shareType, amount: total })
      navigate(`/trade/orders/${order.id}`)
    } catch (err) {
      toast.error(err.message)
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={['Investor Portal', 'Trade']}
        title="Buy Pre-IPO Shares"
        description="Purchase Ameritec Pre-IPO Shares with USDT or Zelle."
        action={
          <span className="flex items-center gap-[8.75px] rounded-full border border-success/20 bg-success-soft px-[15px] py-2.5 text-caption font-semibold text-success">
            <ShieldCheckIcon className="size-[21.25px]" />
            Secure transaction
          </span>
        }
      />

      {error && <p className="text-destructive">Couldn’t load the trade configuration. Please try again.</p>}
      {!config && !error && (
        <div className="flex justify-center py-20">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      )}

      {config && (
        <div className="flex flex-col gap-[17.5px]">
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[17.5px] xl:grid-cols-[minmax(0,1fr)_469.5px]">
            {/* Buy form */}
            <Panel className="p-5 sm:p-[30px]">
              <PanelHeader
                className="border-b border-divider pb-[25px]"
                title="Buy Shares"
                description="Enter the amount you would like to invest."
              />

              <div className="pt-[25px]">
                <label htmlFor="amount" className="text-caption font-semibold">
                  Amount to invest (USDT)
                </label>
                <div
                  className={cn(
                    'mt-2.5 flex h-[65px] items-center rounded-lg border bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30',
                    amountError && 'border-destructive',
                  )}
                >
                  <input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="h-full w-full min-w-0 flex-1 bg-transparent px-[18.75px] text-subheading font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    aria-invalid={!!amountError}
                    aria-describedby="amount-error"
                  />
                  <span className="flex h-[37.5px] items-center border-l border-divider px-[17.5px] text-caption font-semibold text-muted-foreground">
                    USDT
                  </span>
                </div>
                {amountError ? (
                  <p id="amount-error" className="mt-1.5 text-sm text-destructive">
                    {amountError}
                  </p>
                ) : (
                  minCents > 0 && (
                    <p id="amount-error" className="mt-1.5 text-caption text-muted-foreground">
                      {minLabel}: {formatUsdt(minCents / 100)} USDT
                    </p>
                  )
                )}
                <div className="mt-2.5 grid grid-cols-4 gap-[8.75px]">
                  {QUICK_AMOUNTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmountInput(String(v))}
                      className={cn(
                        'h-10 rounded-[7.5px] border bg-muted text-caption font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground',
                        amount === v && 'border-primary text-primary',
                      )}
                    >
                      {formatInt(v)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-[25px]">
                <p id="share-type-label" className="text-caption font-semibold">
                  Class
                </p>
                <div role="radiogroup" aria-labelledby="share-type-label" className="mt-2.5 grid gap-[11.25px] sm:grid-cols-2">
                  {config.shares.map((s) => (
                    <ShareTypeCard key={s.type} share={s} selected={s.type === shareType} onSelect={() => setShareType(s.type)} />
                  ))}
                </div>
              </div>

              <div className="mt-[25px] grid grid-cols-[1fr_40px_1fr] items-center rounded-lg border border-divider bg-muted p-5">
                <div className="space-y-[6.25px]">
                  <p className="text-caption text-muted-foreground">Current Pre-IPO Price</p>
                  <p>
                    <span className="text-2xl font-bold tabular-nums">{formatUsdt(share.price)}</span>{' '}
                    <span className="text-caption font-bold text-muted-foreground">USDT / Share</span>
                  </p>
                </div>
                <span className="mx-auto flex size-[30px] items-center justify-center rounded-full border bg-card text-title text-muted-foreground">
                  ÷
                </span>
                <div className="space-y-[6.25px] text-right">
                  <p className="text-caption text-muted-foreground">Estimated Shares</p>
                  <p>
                    <span className="text-2xl font-bold text-primary tabular-nums">{formatInt(shares)}</span>{' '}
                    <span className="text-caption font-bold text-muted-foreground">Shares</span>
                  </p>
                </div>
              </div>
              <p className="flex flex-wrap items-center justify-center gap-[5px] pt-[11.25px] text-caption text-muted-foreground">
                <CalculatorIcon className="size-[18.75px]" aria-hidden />
                {formatUsdt(amount)} USDT ÷ {formatUsdt(share.price)} USDT =
                <span className="font-semibold text-foreground">{formatInt(shares)} Shares</span>
              </p>

              <div className="mt-[25px] rounded-lg border p-5">
                <div className="flex items-center justify-between border-b border-divider pb-[13.75px]">
                  <h3 className="text-title">Order Summary</h3>
                  <span className="rounded-full bg-muted px-[8.75px] py-[5px] text-caption text-muted-foreground">Estimated</span>
                </div>
                <dl className="pt-[7.5px]">
                  <SummaryRow label="Investment Amount">{formatUsdt(amount)} USDT</SummaryRow>
                  <SummaryRow label="Class">{share.label}</SummaryRow>
                  <SummaryRow label="Price">{formatUsdt(share.price)} USDT / Share</SummaryRow>
                  <SummaryRow label="Estimated Shares">{formatInt(shares)}</SummaryRow>
                  <SummaryRow label="Transaction Fee">
                    <span className="text-success">0 USDT</span>
                  </SummaryRow>
                  <SummaryRow label="Total Payment" strong>
                    {formatUsdt(total)} USDT
                  </SummaryRow>
                </dl>
                {rounded && (
                  <p className="mt-2 rounded-md bg-muted px-3 py-2 text-caption text-muted-foreground">
                    Shares are sold in whole units, so you’ll pay {formatUsdt(total)} USDT for {formatInt(shares)} shares.
                  </p>
                )}
              </div>

              <div className="pt-5">
                <Button size="xl" className="w-full" disabled={shares < 1 || belowMin || !hasPaymentMethod} onClick={() => setConfirming(true)}>
                  Review Purchase
                  <ArrowRightIcon />
                </Button>
                <p className="pt-2.5 text-center text-caption text-subtle">
                  {hasPaymentMethod
                    ? 'You’ll review all details before confirming.'
                    : 'Payments are not available right now. Please contact support.'}
                </p>
              </div>
            </Panel>

            {/* Pre-IPO information */}
            <Panel>
              <div className="flex items-center gap-[13.75px] border-b border-divider pb-[21.25px]">
                <span className="flex size-[42.5px] items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <TrendingUpIcon className="size-[25px]" />
                </span>
                <div>
                  <h2 className="text-subheading font-bold">Pre-IPO Information</h2>
                  <p className="pt-[6.25px] text-caption text-muted-foreground">Current offering details</p>
                </div>
              </div>
              <dl>
                {config.shares.map((s) => (
                  <div key={s.type} className="flex items-center justify-between border-b border-divider py-[18.75px]">
                    <dt className="flex items-center gap-[7.5px] text-caption text-muted-foreground">
                      <ShareSwatch type={s.type} className="size-[8.75px] rounded-[2.5px]" />
                      {s.label} Price
                    </dt>
                    <dd className="text-right">
                      <span className="block text-subheading font-semibold text-primary tabular-nums">{formatUsdt(s.price)}</span>
                      <span className="block pt-[3.75px] text-caption font-medium text-muted-foreground">USDT / Share</span>
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between border-b border-divider py-[18.75px]">
                  <dt className="text-caption text-muted-foreground">Commission Balance</dt>
                  <dd className="text-right">
                    <span className="block text-title font-semibold tabular-nums">{formatUsdt(config.balance)}</span>
                    <span className="block pt-[3.75px] text-caption font-medium text-muted-foreground">USDT</span>
                  </dd>
                </div>
              </dl>
              <div className="mt-[18.75px] flex items-start gap-[11.25px] rounded-lg bg-warning-soft p-[13.75px] text-caption text-[#75521d]">
                <InfoIcon className="size-[22.5px] shrink-0 text-warning" />
                The displayed Pre-IPO price applies to this purchase. Review all transaction details carefully before confirmation.
              </div>
            </Panel>
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
              {orders ? <OrdersTable orders={orders.data} /> : <Spinner className="mx-auto my-10 size-5 text-muted-foreground" />}
            </div>
          </Panel>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !submitting && setConfirming(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Confirm purchase</DialogTitle>
            <DialogDescription>You’ll choose a payment method on the next screen.</DialogDescription>
          </DialogHeader>
          {share && (
            <dl className="rounded-lg border px-4 py-1">
              <SummaryRow label="Class">{share.label}</SummaryRow>
              <SummaryRow label="Shares">{formatInt(shares)}</SummaryRow>
              <SummaryRow label="Price">{formatUsdt(share.price)} USDT / Share</SummaryRow>
              <SummaryRow label="Total Payment" strong>
                {formatUsdt(total)} USDT
              </SummaryRow>
            </dl>
          )}
          <div className="grid gap-2 sm:grid-cols-[2fr_3fr]">
            <Button size="lg" className="sm:order-last" onClick={handleConfirm} disabled={submitting}>
              {submitting && <Spinner />}
              Confirm & continue to payment
            </Button>
            <Button size="lg" variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
              Back
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
