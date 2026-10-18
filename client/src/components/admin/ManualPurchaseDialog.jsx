import { useState } from 'react'
import { AlertTriangleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import { MIN_SHARES, formatShares, formatUsdt, sharesFor } from '@/lib/format'
import { PAYMENT_METHOD_LABEL } from '@/lib/orders'
import { cn } from '@/lib/utils'
import { createManualOrder } from '@/services/admin.service'

const REFERENCE_HINT = {
  bep20: 'Transaction hash (0x…) — recommended, it can’t be reused for another order',
  zelle: 'Zelle confirmation number',
  other: 'Bank reference or short description',
}

function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-caption font-semibold">{label}</span>
      {children}
      {error ? <span className="block text-sm text-destructive">{error}</span> : hint && <span className="block text-caption text-muted-foreground">{hint}</span>}
    </div>
  )
}

/**
 * Admin buys shares on behalf of a user whose payment arrived but never showed up in the system.
 * Shares are credited at the current class price right away; the admin decides about the referral commission.
 */
export default function ManualPurchaseDialog({ open, user, onClose, onCreated }) {
  const { holdings, referredBy } = user
  const [form, setForm] = useState({ shareType: 'A', amount: '', paymentMethod: 'zelle', reference: '', note: '', payCommission: !!referredBy })
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const price = holdings[form.shareType].price
  const rate = holdings[form.shareType].commissionPct
  const amount = Number(form.amount) || 0
  const amountCents = Math.round(amount * 100)
  const shares = price ? sharesFor(amountCents, Math.round(price * 100)) : 0
  const validAmount = shares >= MIN_SHARES
  const commission = Math.floor((amountCents * rate) / 100) / 100

  const submit = async (e) => {
    e.preventDefault()
    if (!validAmount) return setErrors({ amount: 'Enter an amount big enough to buy shares' })
    setSaving(true)
    try {
      const { data } = await createManualOrder(user._id, {
        shareType: form.shareType,
        amount,
        paymentMethod: form.paymentMethod,
        reference: form.reference.trim() || undefined,
        note: form.note.trim() || undefined,
        payCommission: form.payCommission,
      })
      toast.success(`${data.order.orderCode}: ${formatShares(data.order.shares)} Class ${form.shareType} shares credited`)
      onCreated(data)
    } catch (err) {
      setErrors({ amount: err.details?.amount, reference: err.details?.reference })
      if (!err.details) toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Manual purchase for {user.fullName}</DialogTitle>
            <DialogDescription>For a payment the user already made that isn’t in the system. The order is completed and the shares are credited immediately.</DialogDescription>
          </DialogHeader>

          <Field label="Class">
            <div role="radiogroup" aria-label="Class" className="grid gap-2 sm:grid-cols-2">
              {['A', 'B'].map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.shareType === t}
                  onClick={() => set('shareType', t)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                    form.shareType === t ? 'border-primary bg-primary-soft' : 'bg-card hover:border-primary/50',
                  )}
                >
                  <ShareSwatch type={t} />
                  <span>
                    <span className="block text-sm font-bold">{holdings[t].label}</span>
                    <span className="block text-caption text-muted-foreground">{formatUsdt(holdings[t].price)} USDT / share</span>
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Amount paid (USDT)" error={errors.amount}>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="e.g. 10"
              aria-invalid={!!errors.amount}
              className="tabular-nums"
            />
            <p className="text-caption text-muted-foreground">
              {validAmount ? (
                <>
                  {formatUsdt(amount)} USDT ÷ {formatUsdt(price)} = <span className="font-bold text-foreground">{formatShares(shares)} shares</span>
                  <span> (3 decimals, rounded from the 4th)</span>
                </>
              ) : (
                'Shares = amount ÷ the class price at this moment.'
              )}
            </p>
          </Field>

          <Field label="How did they pay?">
            <div role="radiogroup" aria-label="Payment method" className="flex flex-wrap gap-2">
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.paymentMethod === value}
                  onClick={() => set('paymentMethod', value)}
                  className={cn(
                    'h-9 rounded-lg border px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                    form.paymentMethod === value ? 'border-primary bg-primary-soft text-primary' : 'bg-card text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Payment reference" error={errors.reference} hint={REFERENCE_HINT[form.paymentMethod]}>
            <Input value={form.reference} onChange={(e) => set('reference', e.target.value)} maxLength={200} spellCheck={false} autoComplete="off" aria-invalid={!!errors.reference} className={form.paymentMethod === 'bep20' ? 'font-mono text-sm' : ''} />
          </Field>

          <Field label="Internal note" hint="Why this order was created by hand. Kept in the audit log.">
            <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={500} rows={2} />
          </Field>

          <label className={cn('flex items-start gap-2.5 rounded-lg border p-3 text-sm', !referredBy && 'opacity-60')}>
            <Checkbox className="mt-0.5" checked={form.payCommission} disabled={!referredBy} onCheckedChange={(v) => set('payCommission', v === true)} />
            <span className="space-y-0.5">
              <span className="block font-semibold">Pay referral commission</span>
              <span className="block text-caption text-muted-foreground">
                {referredBy ? (
                  form.payCommission ? (
                    <>
                      <span className="font-semibold text-foreground">{referredBy.fullName}</span> earns {rate}% = <span className="font-semibold text-foreground">{formatUsdt(commission)} USDT</span>. It follows the usual rules: held as
                      pending until everyone involved is verified.
                    </>
                  ) : (
                    <>
                      {referredBy.fullName} will <span className="font-semibold text-foreground">not</span> be paid for this order.
                    </>
                  )
                ) : (
                  'This user has no referrer, so there is no commission to pay.'
                )}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded-lg bg-warning-soft p-3 text-caption text-[#75521d]">
            <Checkbox className="mt-0.5" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span className="space-y-0.5">
              <span className="flex items-center gap-1.5 font-bold">
                <AlertTriangleIcon className="size-4 text-warning" />
                I confirmed the payment was received
              </span>
              <span className="block">Shares are credited right away and can’t be undone from here. This action is recorded in the audit log.</span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !confirmed || !validAmount}>
              {saving && <Spinner />}
              Create order &amp; credit shares
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
