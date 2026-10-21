import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  HourglassIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  ScanFaceIcon,
  WalletIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import ConfirmIdentity, { confirmError, confirmPayload } from '@/components/auth/ConfirmIdentity'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { formatUsdt, formatDateTime24 } from '@/lib/format'
import { bscscanTxUrl } from '@/lib/orders'
import { cn } from '@/lib/utils'
import { createWithdrawal, getWallet, listCommissions, saveWallet } from '@/services/referral.service'

const short = (a = '') => `${a.slice(0, 8)}…${a.slice(-6)}`
const WITHDRAWAL_STATUS = {
  pending: { label: 'Processing', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

function Stat({ icon, label, value, note, tone }) {
  const Icon = icon
  const tones = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    neutral: 'bg-muted text-muted-foreground',
  }
  return (
    <div className="rounded-xl border bg-card p-[18.75px]">
      <div className="flex items-center gap-2.5">
        <span className={cn('flex size-[34px] items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-[19px]" />
        </span>
        <p className="text-caption font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="pt-3 text-[28px] leading-tight font-bold tabular-nums">
        {value} <span className="text-caption font-semibold text-muted-foreground">USDT</span>
      </p>
      <p className="pt-1.5 text-caption text-muted-foreground">{note}</p>
    </div>
  )
}

function WalletDialog({ open, current, onClose, onSaved }) {
  const twoFactor = !!useAuth().user?.twoFactor?.enabled
  const [address, setAddress] = useState(current ?? '')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) next.address = 'Enter a valid BNB Smart Chain address (0x… 42 characters)'
    next.code = confirmError(twoFactor, code) || undefined
    if (!next.code) delete next.code
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      await saveWallet(address.trim(), confirmPayload(twoFactor, code))
      toast.success('Withdrawal wallet saved')
      onSaved()
    } catch (err) {
      setErrors({ address: err.details?.address, code: err.details?.code ?? err.details?.password ?? (err.details?.address ? undefined : err.message) })
      setCode('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">{current ? 'Change withdrawal wallet' : 'Add withdrawal wallet'}</DialogTitle>
            <DialogDescription>Your commission is paid to this wallet in USDT on BNB Smart Chain (BEP20).</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="wallet-address" className="text-caption font-semibold">
              Wallet address
            </label>
            <Input
              id="wallet-address"
              size="lg"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                setErrors((x) => ({ ...x, address: undefined }))
              }}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-sm"
              aria-invalid={!!errors.address}
            />
            {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-caption text-[#75521d]">
            <InfoIcon className="mt-px size-4 shrink-0 text-warning" />
            Only use a wallet you control that supports BNB Smart Chain. USDT sent to a wrong or exchange-incompatible address can’t be recovered.
          </div>
          <ConfirmIdentity twoFactor={twoFactor} value={code} onChange={(v) => { setCode(v); setErrors((x) => ({ ...x, code: undefined })) }} error={errors.code} disabled={saving} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Save wallet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function WithdrawDialog({ open, wallet, onClose, onDone }) {
  const twoFactor = !!useAuth().user?.twoFactor?.enabled
  const [amount, setAmount] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const { available, min } = { available: wallet.balance.available, min: wallet.minWithdrawal }

  const submit = async (e) => {
    e.preventDefault()
    const value = Number(amount)
    const next = {}
    if (!value || value <= 0) next.amount = 'Enter an amount'
    else if (value < min) next.amount = `Minimum withdrawal is ${formatUsdt(min)} USDT`
    else if (value > available) next.amount = 'More than your available balance'
    next.code = confirmError(twoFactor, code) || undefined
    if (!next.code) delete next.code
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      await createWithdrawal(value, confirmPayload(twoFactor, code))
      toast.success('Withdrawal requested — we’ll send your USDT soon')
      onDone()
    } catch (err) {
      setErrors({ amount: err.details?.amount, code: err.details?.code ?? err.details?.password ?? (err.details?.amount ? undefined : err.message) })
      setCode('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Withdraw commission</DialogTitle>
            <DialogDescription>Available to withdraw: {formatUsdt(available)} USDT</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="withdraw-amount" className="text-caption font-semibold">
              Amount (USDT)
            </label>
            <div className="flex gap-2">
              <Input
                id="withdraw-amount"
                size="lg"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setErrors((x) => ({ ...x, amount: undefined }))
                }}
                placeholder={`Min ${formatUsdt(min)}`}
                aria-invalid={!!errors.amount}
                className="tabular-nums"
              />
              <Button type="button" variant="outline" size="lg" onClick={() => setAmount(String(available))}>
                Max
              </Button>
            </div>
            {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
          </div>
          <div className="rounded-lg border bg-muted/50 p-3 text-caption">
            <p className="text-muted-foreground">Paid to</p>
            <p className="pt-0.5 font-mono font-semibold break-all">{wallet.address}</p>
            <p className="pt-1 text-muted-foreground">{wallet.token} · {wallet.network} · no fee</p>
            {wallet.withdrawalMode !== 'auto' && <p className="pt-1 text-muted-foreground">Requests are reviewed and sent by our team manually — you’ll be notified once it’s paid.</p>}
          </div>
          <ConfirmIdentity twoFactor={twoFactor} value={code} onChange={(v) => { setCode(v); setErrors((x) => ({ ...x, code: undefined })) }} error={errors.code} disabled={saving} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Request withdrawal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Which referrals are holding commission back (their purchase is fine, but their face scan isn't approved yet). */
function PendingList() {
  const { data } = useAsync(() => listCommissions({ status: 'pending', limit: 5 }), [])
  if (!data) return <Spinner className="mx-auto my-3 size-4 text-muted-foreground" />
  return (
    <ul className="mt-3 divide-y divide-warning/15 rounded-lg border border-warning/20 bg-card">
      {data.data.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3.5 py-2.5 text-caption">
          <span>
            <span className="font-semibold">{c.member}</span>
            <span className="text-muted-foreground">
              {' '}
              · {c.orderCode} · waiting for their face scan to be approved
            </span>
          </span>
          <span className="font-bold text-warning tabular-nums">+{formatUsdt(c.amount)} USDT</span>
        </li>
      ))}
      {data.pagination.total > data.data.length && (
        <li className="px-3.5 py-2 text-caption text-muted-foreground">+{data.pagination.total - data.data.length} more — see the commission history below</li>
      )}
    </ul>
  )
}

/** "Commission wallet": withdrawable vs held balances, the payout wallet and recent withdrawals. */
export default function CommissionWallet({ onChanged }) {
  const [reloadKey, setReloadKey] = useState(0)
  const { data: wallet } = useAsync(getWallet, [reloadKey])
  const [dialog, setDialog] = useState(null) // 'wallet' | 'withdraw'
  const [showPending, setShowPending] = useState(false)

  const refresh = () => {
    setDialog(null)
    setReloadKey((k) => k + 1)
    onChanged?.()
  }

  if (!wallet) {
    return (
      <Panel>
        <Spinner className="mx-auto my-8 size-5 text-muted-foreground" />
      </Panel>
    )
  }
  const { balance } = wallet
  // Withdrawing needs the user's own approved face scan; everything else (buying, viewing) works without it
  const faceReady = wallet.canWithdraw !== false
  const canWithdraw = faceReady && !!wallet.address && balance.available >= wallet.minWithdrawal
  const withdrawHint = !faceReady
    ? 'Your face scan must be approved before you can withdraw'
    : wallet.address && !canWithdraw
      ? `Minimum withdrawal is ${formatUsdt(wallet.minWithdrawal)} USDT`
      : undefined

  return (
    <Panel className="space-y-5">
      <PanelHeader
        title="Commission wallet"
        description="Commission from your direct referrals’ purchases. Only the available balance can be withdrawn."
        action={
          <Button
            size="lg"
            className="font-bold shadow-brand"
            onClick={() => (wallet.address ? setDialog('withdraw') : setDialog('wallet'))}
            disabled={!faceReady || (!!wallet.address && !canWithdraw)}
            title={withdrawHint}
          >
            <ArrowUpRightIcon />
            Withdraw
          </Button>
        }
      />

      <div className="grid gap-[12.5px] md:grid-cols-3">
        <Stat icon={CheckCircle2Icon} tone="success" label="Available to withdraw" value={formatUsdt(balance.available)} note="Ready to be paid to your wallet" />
        <Stat
          icon={HourglassIcon}
          tone="warning"
          label="Pending — waiting for verification"
          value={formatUsdt(balance.pending)}
          note={balance.pending > 0 ? 'Released when your referrals’ face scans are approved' : 'Nothing waiting right now'}
        />
        <Stat
          icon={BanknoteIcon}
          tone="neutral"
          label="Withdrawn"
          value={formatUsdt(balance.withdrawn)}
          note={balance.requested > 0 ? `${formatUsdt(balance.requested)} USDT being processed` : `Total earned ${formatUsdt(balance.earned)} USDT`}
        />
      </div>

      {!faceReady && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary-soft/60 p-3.5">
          <ScanFaceIcon className="size-[22px] shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-caption">
            <span className="font-bold">Withdrawals need an approved face scan.</span>{' '}
            {wallet.faceStatus === 'pending'
              ? 'Your face scan is waiting for review — you can withdraw as soon as it’s approved.'
              : 'Your commission keeps adding up in the meantime. Scan your face once and, after an admin approves it, you can withdraw.'}
          </p>
          {wallet.faceStatus !== 'pending' && (
            <Link to="/account?tab=identity" className={buttonVariants({ size: 'sm' })}>
              {wallet.faceStatus === 'rejected' ? 'Scan again' : 'Scan my face'}
            </Link>
          )}
        </div>
      )}

      {balance.pending > 0 && (
        <div className="rounded-lg border border-warning/25 bg-warning-soft/60 p-3.5">
          <button type="button" onClick={() => setShowPending((v) => !v)} aria-expanded={showPending} className="flex w-full items-start gap-2.5 text-left">
            <InfoIcon className="mt-0.5 size-[18px] shrink-0 text-warning" />
            <span className="flex-1 text-caption text-[#75521d]">
              <span className="font-bold">{formatUsdt(balance.pending)} USDT is on hold.</span> Commission becomes withdrawable once the person who bought has
              their face scan approved. See who it’s waiting for.
            </span>
            <ChevronDownIcon className={cn('mt-0.5 size-4 shrink-0 text-warning transition-transform', showPending && 'rotate-180')} />
          </button>
          {showPending && <PendingList />}
        </div>
      )}

      <div className="rounded-xl border p-[18.75px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-[42px] shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <WalletIcon className="size-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-title font-bold">Withdrawal wallet</p>
            {wallet.address ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold">{wallet.token} · BEP20</span>
                <span className="font-mono">{short(wallet.address)}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  onClick={() => {
                    navigator.clipboard.writeText(wallet.address).then(() => toast.success('Address copied'))
                  }}
                >
                  <CopyIcon className="size-3.5" />
                  Copy
                </button>
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">Add the wallet where you want to receive your commission ({wallet.token} on BNB Smart Chain).</p>
            )}
          </div>
          <Button variant="outline" className="bg-card font-semibold" onClick={() => setDialog('wallet')}>
            {wallet.address ? <PencilIcon /> : <PlusIcon />}
            {wallet.address ? 'Change wallet' : 'Add wallet'}
          </Button>
        </div>
      </div>

      {wallet.adjustments?.length > 0 && (
        <div>
          <h3 className="text-title font-bold">Balance adjustments</h3>
          <p className="pt-0.5 text-caption text-muted-foreground">Changes our team made to your balance, with the reason.</p>
          <ul className="mt-2 divide-y divide-divider rounded-lg border">
            {wallet.adjustments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-3 text-caption">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.amount >= 0 ? 'Added to your balance' : 'Deducted from your balance'}</p>
                  <p className="text-muted-foreground">
                    {formatDateTime24(a.date)} · {a.reason}
                  </p>
                </div>
                <span className={cn('text-title font-bold tabular-nums', a.amount >= 0 ? 'text-success' : 'text-danger')}>
                  {a.amount >= 0 ? '+' : '−'}
                  {formatUsdt(Math.abs(a.amount))} USDT
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {wallet.withdrawals.length > 0 && (
        <div>
          <h3 className="text-title font-bold">Recent withdrawals</h3>
          <ul className="mt-2 divide-y divide-divider rounded-lg border">
            {wallet.withdrawals.map((w) => {
              const s = WITHDRAWAL_STATUS[w.status]
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {w.status === 'paid' ? <CheckCircle2Icon className="size-4 text-success" /> : <ClockIcon className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1 text-caption">
                    <p className="font-semibold">
                      {w.code} · {formatDateTime24(w.createdAt)}
                    </p>
                    <p className="truncate text-muted-foreground">
                      To {short(w.address)}
                      {w.status === 'rejected' && w.rejectionReason ? ` · ${w.rejectionReason}` : ''}
                    </p>
                  </div>
                  {w.txHash && (
                    <a href={bscscanTxUrl(w.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline">
                      View tx
                      <ExternalLinkIcon className="size-3.5" />
                    </a>
                  )}
                  <span className="text-title font-bold tabular-nums">{formatUsdt(w.amount)} USDT</span>
                  <StatusBadge tone={s.tone} icon={false} className="h-6">
                    {s.label}
                  </StatusBadge>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <WalletDialog key={`w-${dialog === 'wallet'}`} open={dialog === 'wallet'} current={wallet.address} onClose={() => setDialog(null)} onSaved={refresh} />
      <WithdrawDialog key={`d-${dialog === 'withdraw'}`} open={dialog === 'withdraw'} wallet={wallet} onClose={() => setDialog(null)} onDone={refresh} />
    </Panel>
  )
}
