import { AlertCircleIcon, CheckIcon, CopyIcon, LockKeyholeIcon, LogOutIcon, RepeatIcon, ShieldCheckIcon, WalletIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatUsdt } from '@/lib/format'
import { cn } from '@/lib/utils'

const STEPS = ['Connect wallet', 'Confirm payment', 'Done']
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Stable two-colour gradient from the address, used when the wallet doesn't provide an icon. */
const gradientFor = (address = '0x0000') => {
  const hue = (from) => parseInt(address.slice(from, from + 4), 16) % 360
  return `linear-gradient(135deg, hsl(${hue(2)} 85% 58%), hsl(${hue(6)} 80% 42%))`
}

function Stepper({ current }) {
  return (
    <ol className="flex min-w-0 items-center gap-1.5 sm:gap-2" aria-label="Payment steps">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-1.5 sm:gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-[22px] items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                done && 'bg-success text-white',
                active && 'bg-primary text-white shadow-[0_0_0_4px_var(--primary-soft)]',
                !done && !active && 'bg-muted text-subtle',
              )}
            >
              {done ? <CheckIcon className="size-3.5" /> : i + 1}
            </span>
            {active && <span className="text-caption font-semibold whitespace-nowrap">{label}</span>}
            {i < STEPS.length - 1 && <span className={cn('h-px w-4 sm:w-6', done ? 'bg-success' : 'bg-border')} />}
          </li>
        )
      })}
    </ol>
  )
}

function NetworkPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-caption font-semibold whitespace-nowrap">
      <svg viewBox="0 0 32 32" className="size-4" aria-hidden>
        <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
        <path
          fill="#fff"
          d="M12.1 14.3 16 10.4l3.9 3.9 2.3-2.3L16 5.8 9.8 12zM5.8 16l2.3-2.3 2.3 2.3-2.3 2.3zm6.3 1.7L16 21.6l3.9-3.9 2.3 2.3L16 26.2 9.8 20zm9.5-1.7 2.3-2.3 2.3 2.3-2.3 2.3zM18.3 16 16 13.7 14.3 15.4l-.2.2-.4.4 2.3 2.3 2.3-2.3z"
        />
      </svg>
      <span className="sm:hidden">BSC</span>
      <span className="hidden sm:inline">BNB Smart Chain</span>
    </span>
  )
}

function CopyAddress({ address }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address)
          setCopied(true)
          toast.success('Address copied')
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error('Copy failed')
        }
      }}
      className="group inline-flex items-center gap-1.5 rounded-md font-mono text-caption text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
      aria-label="Copy wallet address"
    >
      {short(address)}
      {copied ? <CheckIcon className="size-3.5 text-success" /> : <CopyIcon className="size-3.5 opacity-60 group-hover:opacity-100" />}
    </button>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-caption">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

/** Presentational wallet payment card: connect → pay → processing. All behaviour comes in through props. */
export default function WalletPanel({
  amount,
  address,
  walletName = 'Wallet',
  walletIcon,
  networkOk = true,
  balance,
  busy,
  error,
  sentHash,
  onConnect,
  onChange,
  onDisconnect,
  onPay,
}) {
  const connected = !!address
  const stage = !connected ? 'connect' : busy ? 'processing' : 'pay'
  const step = !connected ? 0 : busy === 'submitting' ? 2 : 1
  const insufficient = balance != null && balance < amount

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
      <header className="flex items-center justify-between gap-3 border-b bg-muted/60 px-4 py-3 sm:px-5">
        <Stepper current={step} />
        <NetworkPill />
      </header>

      <div className="p-4 sm:p-6">
        {stage === 'connect' && (
          <div className="flex flex-col items-center text-center">
            <span className="relative flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/10 [animation-duration:2.5s]" />
              <WalletIcon className="relative size-8" />
            </span>
            <h3 className="mt-4 text-subheading font-bold">Connect your wallet</h3>
            <p className="mt-1.5 max-w-sm text-caption text-muted-foreground">
              Choose the wallet that holds your USDT. You’ll confirm the payment of{' '}
              <span className="font-semibold text-foreground">{formatUsdt(amount)} USDT</span> inside it.
            </p>
            <Button type="button" size="xl" className="mt-5 w-full max-w-sm shadow-brand" onClick={onConnect}>
              <WalletIcon />
              Choose wallet
            </Button>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {['MetaMask', 'Trust Wallet', 'Binance Web3', 'OKX', 'Coinbase', '300+ via WalletConnect'].map((w) => (
                <span key={w} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="relative flex size-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
              <span className="relative flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Spinner className="size-7" />
              </span>
            </span>
            <h3 className="mt-4 text-subheading font-bold">{busy === 'sending' ? `Confirm in ${walletName}` : 'Completing your purchase…'}</h3>
            <p className="mt-1.5 max-w-sm text-caption text-muted-foreground">
              {busy === 'sending'
                ? `Approve the transfer of ${formatUsdt(amount)} USDT in your wallet. Don’t close this page.`
                : 'Your payment was sent. We’re finalising your order — this only takes a moment.'}
            </p>
          </div>
        )}

        {stage === 'pay' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              {walletIcon ? (
                <img src={walletIcon} alt="" className="size-11 rounded-xl border bg-card object-contain p-1" />
              ) : (
                <span className="size-11 shrink-0 rounded-xl" style={{ background: gradientFor(address) }} aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-title font-bold">{walletName}</p>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                    <span className="size-1.5 rounded-full bg-success" />
                    Connected
                  </span>
                  <CopyAddress address={address} />
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={onChange} aria-label="Change wallet" title="Change wallet">
                  <RepeatIcon />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={onDisconnect} aria-label="Disconnect wallet" title="Disconnect">
                  <LogOutIcon />
                </Button>
              </div>
            </div>

            <dl className="divide-y divide-divider rounded-lg border px-4">
              <Row label="Network">
                {networkOk ? (
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <span className="size-1.5 rounded-full bg-success" />
                    BNB Smart Chain
                  </span>
                ) : (
                  <span className="text-warning">Will switch to BNB Smart Chain</span>
                )}
              </Row>
              <Row label="Your USDT balance">
                {balance == null ? (
                  <span className="text-subtle">…</span>
                ) : (
                  <span className={cn('tabular-nums', insufficient && 'text-destructive')}>{formatUsdt(balance)} USDT</span>
                )}
              </Row>
              <Row label="Network fee">
                <span className="text-muted-foreground">Paid in BNB from your wallet</span>
              </Row>
            </dl>

            <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary-soft to-primary-soft/40 p-4 text-center">
              <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">You pay</p>
              <p className="mt-1 text-[34px] leading-tight font-bold tracking-[-0.01em] tabular-nums">
                {formatUsdt(amount)} <span className="text-title font-semibold text-muted-foreground">USDT</span>
              </p>
            </div>

            {insufficient && (
              <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-caption text-danger">
                <AlertCircleIcon className="mt-px size-4 shrink-0" />
                This wallet only holds {formatUsdt(balance)} USDT on BNB Smart Chain. Add funds or switch to another wallet.
              </p>
            )}

            <Button type="button" size="xl" className="w-full shadow-brand" onClick={onPay} disabled={insufficient}>
              <LockKeyholeIcon />
              {sentHash ? 'Submit my payment' : `Pay ${formatUsdt(amount)} USDT`}
            </Button>
            {sentHash && (
              <p className="text-center text-caption text-muted-foreground">
                Your transfer was already sent ({short(sentHash)}). Press the button to finish — don’t send USDT again.
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-caption text-danger">
            <AlertCircleIcon className="mt-px size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <footer className="flex items-center justify-center gap-2 border-t bg-muted/40 px-4 py-2.5 text-center text-[11px] text-muted-foreground">
        <ShieldCheckIcon className="size-3.5 shrink-0 text-success" />
        Non-custodial — USDT goes straight from your wallet. We never see your keys.
      </footer>
    </section>
  )
}
