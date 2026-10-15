import { useEffect, useRef, useState } from 'react'
import { ImageUpIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import { formatDate } from '@/lib/format'
import * as adminService from '@/services/admin.service'

function Section({ title, description, children }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)] sm:p-[25px]">
      <h2 className="text-subheading font-bold">{title}</h2>
      {description && <p className="pt-1 text-caption text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, hint, error, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-caption font-semibold">{label}</span>
      {children}
      {error ? (
        <span className="block text-sm text-destructive">{error}</span>
      ) : (
        hint && <span className="block text-caption text-muted-foreground">{hint}</span>
      )}
    </label>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  )
}

export default function AdminParametersPage() {
  const [form, setForm] = useState(null)
  const [meta, setMeta] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [qrVersion, setQrVersion] = useState(0)
  const qrInput = useRef(null)

  const applyServerData = (data) => {
    const { hasQr, ...zelle } = data.payment.zelle
    setForm({
      shares: data.shares,
      minPurchase: data.minPurchase,
      payment: { bep20: data.payment.bep20, zelle },
    })
    setMeta({ hasQr, updatedAt: data.updatedAt })
  }

  useEffect(() => {
    adminService
      .getSettings()
      .then(({ data }) => applyServerData(data))
      .catch((err) => toast.error(err.message))
  }, [])

  /** Immutable update by path, e.g. set('shares.A.price', '2.5') */
  const set = (path, value) => {
    setErrors((e) => ({ ...e, [path]: undefined }))
    setForm((prev) => {
      const next = structuredClone(prev)
      const keys = path.split('.')
      keys.slice(0, -1).reduce((o, k) => o[k], next)[keys.at(-1)] = value
      return next
    })
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const { data } = await adminService.updateSettings(form)
      applyServerData(data)
      toast.success('Parameters saved')
    } catch (err) {
      setErrors(err.details ?? {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const uploadQr = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const { data } = await adminService.uploadZelleQr(file)
      setMeta((m) => ({ ...m, hasQr: data.payment.zelle.hasQr }))
      setQrVersion((v) => v + 1)
      toast.success('Zelle QR updated')
    } catch (err) {
      toast.error(err.details?.qr ?? err.message)
    } finally {
      setUploading(false)
    }
  }

  if (!form) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={save} className="space-y-[17.5px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Operational Parameters</h1>
          <p className="pt-[6.25px] text-title text-muted-foreground">
            Class prices, purchase minimums, referral commissions and payment methods.
            {meta?.updatedAt && <span className="text-caption"> Last updated {formatDate(meta.updatedAt)}.</span>}
          </p>
        </div>
        <Button type="submit" className="h-[50px] min-w-[140px] px-[21.25px] text-title font-bold" disabled={saving}>
          {saving && <Spinner className="size-5" />}
          Save changes
        </Button>
      </div>

      <div className="grid gap-[17.5px] lg:grid-cols-2">
        {['A', 'B'].map((t) => (
          <Section
            key={t}
            title={
              <span className="flex items-center gap-2">
                <ShareSwatch type={t} />
                Class {t}
              </span>
            }
            description="Changes apply to new orders only; existing orders keep the price they were created with."
          >
            <Field
              label="Price (USDT per share)"
              hint={`Investors get the amount they pay ÷ this price in Class ${t} shares, e.g. 100 USDT at 1 USDT = 100 shares.`}
              error={errors[`shares.${t}.price`] ?? errors.shares}
            >
              <Input
                size="lg"
                type="number"
                step="0.01"
                min="0.01"
                value={form.shares[t].price}
                onChange={(e) => set(`shares.${t}.price`, e.target.value)}
                required
              />
            </Field>
            <Field
              label="F1 commission (% of purchase amount)"
              hint={`Paid to the buyer’s direct referrer when a Class ${t} purchase is completed.`}
              error={errors[`shares.${t}.commissionPct`]}
            >
              <Input
                size="lg"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.shares[t].commissionPct}
                onChange={(e) => set(`shares.${t}.commissionPct`, e.target.value)}
                required
              />
            </Field>
            <Field label="Display name">
              <Input size="lg" value={form.shares[t].label} onChange={(e) => set(`shares.${t}.label`, e.target.value)} maxLength={50} required />
            </Field>
            <Field label="Description" hint="Shown under the name on the Trade page, e.g. “Common shares”.">
              <Input size="lg" value={form.shares[t].description} onChange={(e) => set(`shares.${t}.description`, e.target.value)} maxLength={100} />
            </Field>
          </Section>
        ))}
      </div>

      <Section title="Minimum purchase" description="Smallest amount an investor can pay per order, for any class. Enter 0 for no minimum.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First purchase (USDT)" hint="Applies until the investor has a completed purchase." error={errors['minPurchase.first']}>
            <Input
              size="lg"
              type="number"
              step="0.01"
              min="0"
              value={form.minPurchase.first}
              onChange={(e) => set('minPurchase.first', e.target.value)}
              required
            />
          </Field>
          <Field label="Second purchase onwards (USDT)" error={errors['minPurchase.next']}>
            <Input
              size="lg"
              type="number"
              step="0.01"
              min="0"
              value={form.minPurchase.next}
              onChange={(e) => set('minPurchase.next', e.target.value)}
              required
            />
          </Field>
        </div>
      </Section>

      <div className="grid gap-[17.5px] lg:grid-cols-2">
        <Section title="USDT (BEP20)" description="Payments are verified automatically on BNB Smart Chain.">
          <Toggle checked={form.payment.bep20.enabled} onChange={(v) => set('payment.bep20.enabled', v)} label="Accept USDT (BEP20) payments" />
          <Field
            label="Receiving wallet address"
            hint="Double-check this address — funds sent to a wrong address cannot be recovered."
            error={errors['payment.bep20.address'] ?? errors.payment}
          >
            <Input
              size="lg"
              value={form.payment.bep20.address}
              onChange={(e) => set('payment.bep20.address', e.target.value.trim())}
              placeholder="0x…"
              className="font-mono text-sm"
              spellCheck={false}
            />
          </Field>
        </Section>

        <Section title="Zelle" description="Only offered to investors with a US (+1) phone number. Admins confirm Zelle payments manually.">
          <Toggle checked={form.payment.zelle.enabled} onChange={(v) => set('payment.zelle.enabled', v)} label="Accept Zelle payments" />
          <Field label="Recipient (email or phone registered with Zelle)" error={errors['payment.zelle.recipient']}>
            <Input size="lg" value={form.payment.zelle.recipient} onChange={(e) => set('payment.zelle.recipient', e.target.value)} />
          </Field>
          <Field label="Recipient name">
            <Input size="lg" value={form.payment.zelle.recipientName} onChange={(e) => set('payment.zelle.recipientName', e.target.value)} />
          </Field>
          <div className="space-y-1.5">
            <span className="text-caption font-semibold">Zelle QR code</span>
            <div className="flex items-center gap-4">
              {meta?.hasQr ? (
                <img
                  src={`${adminService.adminZelleQrUrl()}?v=${qrVersion}`}
                  alt="Zelle QR code"
                  className="size-24 rounded-lg border object-contain p-1"
                />
              ) : (
                <span className="flex size-24 items-center justify-center rounded-lg border border-dashed text-caption text-subtle">No QR</span>
              )}
              <input ref={qrInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={uploadQr} />
              <Button type="button" variant="outline" onClick={() => qrInput.current?.click()} disabled={uploading}>
                {uploading ? <Spinner /> : <ImageUpIcon />}
                {meta?.hasQr ? 'Replace QR' : 'Upload QR'}
              </Button>
            </div>
            <span className="block text-caption text-muted-foreground">Export the QR from your bank’s Zelle screen (PNG/JPG, max 2 MB).</span>
          </div>
        </Section>
      </div>
    </form>
  )
}
