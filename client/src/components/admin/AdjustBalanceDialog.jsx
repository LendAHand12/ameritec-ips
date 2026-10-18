import { useState } from 'react'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { formatUsdt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { adjustBalance } from '@/services/admin.service'

/** Add to or deduct from a user's withdrawable commission balance. A reason is mandatory and visible to the user. */
export default function AdjustBalanceDialog({ user, onClose, onDone }) {
  const available = user.wallet.available
  const [direction, setDirection] = useState('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const value = Number(amount) || 0
  const result = direction === 'add' ? available + value : available - value
  const tooMuch = direction === 'deduct' && value > available
  const reasonOk = reason.trim().length >= 3

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!(value > 0)) next.amount = 'Enter an amount'
    else if (tooMuch) next.amount = `Can’t deduct more than the available balance (${formatUsdt(available)} USDT)`
    if (!reasonOk) next.reason = 'A reason is required (at least 3 characters)'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const { data } = await adjustBalance(user._id, { direction, amount: value, reason: reason.trim() })
      toast.success(`Balance ${direction === 'add' ? 'increased' : 'reduced'} to ${formatUsdt(data.after)} USDT`)
      onDone()
    } catch (err) {
      setErrors({ amount: err.details?.amount, reason: err.details?.reason })
      if (!err.details) toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Adjust balance — {user.fullName}</DialogTitle>
            <DialogDescription>
              Changes the commission balance the user can withdraw. Current: <span className="font-semibold text-foreground">{formatUsdt(available)} USDT</span>
            </DialogDescription>
          </DialogHeader>

          <div role="radiogroup" aria-label="Adjustment type" className="grid grid-cols-2 gap-2">
            {[
              ['add', 'Add to balance', PlusIcon],
              ['deduct', 'Deduct from balance', MinusIcon],
            ].map(([value, label, icon]) => {
              const Icon = icon
              return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={direction === value}
                onClick={() => {
                  setDirection(value)
                  setErrors({})
                }}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                  direction === value ? (value === 'add' ? 'border-success bg-success-soft text-success' : 'border-destructive bg-danger-soft text-danger') : 'bg-card text-muted-foreground hover:border-primary/50',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="adjust-amount" className="text-caption font-semibold">
              Amount (USDT)
            </label>
            <Input
              id="adjust-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setErrors((x) => ({ ...x, amount: undefined }))
              }}
              aria-invalid={!!errors.amount}
              className="tabular-nums"
            />
            {(errors.amount || tooMuch) && (
              <p className="text-sm text-destructive">{errors.amount ?? `Can’t deduct more than the available balance (${formatUsdt(available)} USDT)`}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="adjust-reason" className="text-caption font-semibold">
              Reason <span className="font-normal text-primary">(required)</span>
            </label>
            <Textarea
              id="adjust-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setErrors((x) => ({ ...x, reason: undefined }))
              }}
              rows={3}
              maxLength={500}
              aria-invalid={!!errors.reason}
              placeholder="e.g. Compensation for the failed payout on Oct 12"
            />
            {errors.reason ? (
              <p className="text-sm text-destructive">{errors.reason}</p>
            ) : (
              <p className="text-caption text-muted-foreground">Saved in the audit log and shown to the user next to this adjustment.</p>
            )}
          </div>

          {value > 0 && !tooMuch && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3.5 py-2.5 text-caption">
              <span className="text-muted-foreground">New balance</span>
              <span className="text-title font-bold tabular-nums">
                {formatUsdt(available)} <span className={direction === 'add' ? 'text-success' : 'text-danger'}>{direction === 'add' ? '+' : '−'} {formatUsdt(value)}</span> = {formatUsdt(result)} USDT
              </span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant={direction === 'deduct' ? 'destructive' : 'default'} disabled={saving || !(value > 0) || !reasonOk || tooMuch}>
              {saving && <Spinner />}
              {direction === 'add' ? 'Add to balance' : 'Deduct from balance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
