import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  WalletIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import CopyButton from '@/components/CopyButton'
import PageHeader from '@/components/PageHeader'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import SegmentedControl from '@/components/dashboard/SegmentedControl'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatDate, formatInt, formatUsdt } from '@/lib/format'
import { ORDER_STATUS, PAYMENT_METHOD_LABEL, bscscanTxUrl } from '@/lib/orders'
import { cn } from '@/lib/utils'
import * as trade from '@/services/trade.service'

const POLL_MS = 10_000

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-divider py-3 text-caption last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-all">{children}</dd>
    </div>
  )
}

function CopyField({ label, value, mono }) {
  return (
    <div>
      <p className="text-caption font-semibold">{label}</p>
      <div className="mt-2 flex gap-2.5">
        <code className={cn('flex min-h-[45px] min-w-0 flex-1 items-center rounded-lg border bg-muted px-[13.75px] text-caption break-all', !mono && 'font-sans')}>
          {value}
        </code>
        <CopyButton value={value} label={label} className="h-auto min-h-[45px] px-4 font-bold">
          Copy
        </CopyButton>
      </div>
    </div>
  )
}

function Bep20Payment({ order, method, onSubmitted }) {
  const [qr, setQr] = useState('')
  const [txHash, setTxHash] = useState(order.txHash ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(method.address, { width: 240, margin: 1 }).then(setQr)
  }, [method.address])

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const { order: updated } = await trade.submitPayment(order.id, { method: 'bep20', txHash: txHash.trim() })
      onSubmitted(updated)
    } catch (err) {
      setError(err.details?.txHash ?? err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        {qr && <img src={qr} alt="Payment address QR code" className="size-[150px] shrink-0 self-center rounded-lg border p-1.5" />}
        <div className="min-w-0 flex-1 space-y-4">
          <CopyField label="Amount to send" value={`${formatUsdt(order.amount)}`} />
          <CopyField label="USDT deposit address" value={method.address} mono />
          <p className="text-caption text-muted-foreground">
            Network <span className="font-bold text-foreground">{method.network}</span> · Token{' '}
            <span className="font-bold text-foreground">{method.token}</span>
          </p>
        </div>
      </div>

      <div className="flex items-start gap-[11.25px] rounded-lg bg-warning-soft p-[13.75px] text-caption text-[#75521d]">
        <AlertTriangleIcon className="size-[21.25px] shrink-0 text-warning" />
        <div className="space-y-1">
          <p className="font-bold">Verify the network before sending</p>
          <p>
            Only send USDT on BNB Smart Chain (BEP20). Sending other tokens or using another network may result in loss of funds. Send the
            full amount in a single transfer.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-2.5">
        <label htmlFor="txHash" className="text-caption font-semibold">
          Transaction hash (TxID)
        </label>
        <Input
          id="txHash"
          size="lg"
          value={txHash}
          onChange={(e) => {
            setTxHash(e.target.value)
            setError('')
          }}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-sm"
          aria-invalid={!!error}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-caption text-muted-foreground">After sending, paste the transaction hash from your wallet. We verify it on-chain automatically.</p>
        <Button type="submit" size="xl" className="w-full" disabled={submitting || !txHash.trim()}>
          {submitting && <Spinner className="size-5" />}
          I’ve paid — verify my payment
        </Button>
      </form>
    </div>
  )
}

function ZellePayment({ order, method, onSubmitted }) {
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { order: updated } = await trade.submitPayment(order.id, { method: 'zelle', reference: reference.trim() || undefined })
      onSubmitted(updated)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        {method.hasQr && (
          <img src={trade.zelleQrUrl()} alt="Zelle QR code" className="size-[150px] shrink-0 self-center rounded-lg border object-contain p-1.5" />
        )}
        <div className="min-w-0 flex-1 space-y-4">
          <CopyField label="Send to (Zelle)" value={method.recipient} />
          {method.recipientName && (
            <p className="text-caption text-muted-foreground">
              Recipient name <span className="font-bold text-foreground">{method.recipientName}</span>
            </p>
          )}
          <CopyField label="Amount (USD)" value={formatUsdt(order.amount)} />
        </div>
      </div>

      <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary-soft/40 p-4">
        <CopyField label="Memo / message — required" value={order.orderCode} />
        <p className="mt-2 text-caption text-muted-foreground">
          Paste this code into the Zelle memo so we can match your payment. Zelle QR codes only fill in the recipient, not the memo or amount.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-2.5">
        <label htmlFor="reference" className="text-caption font-semibold">
          Zelle confirmation number <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input id="reference" size="lg" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} autoComplete="off" />
        <Button type="submit" size="xl" className="w-full" disabled={submitting}>
          {submitting && <Spinner className="size-5" />}
          I’ve paid
        </Button>
        <p className="text-center text-caption text-subtle">Our team will confirm your Zelle payment, usually within 1 business day.</p>
      </form>
    </div>
  )
}

function StatusPanel({ order }) {
  const map = {
    verifying: {
      icon: <Spinner className="size-6" />,
      tone: 'bg-warning-soft text-warning',
      title: 'Verifying your payment on BNB Smart Chain',
      text: order.paymentError ?? 'This usually takes a minute. You can leave this page — we keep checking.',
    },
    pending_review: {
      icon: <ClockIcon className="size-6" />,
      tone: 'bg-warning-soft text-warning',
      title: 'Payment submitted — waiting for review',
      text:
        order.paymentMethod === 'bep20' && order.paymentError
          ? `We couldn’t verify this transaction automatically: ${order.paymentError}. Our team will review it, or you can submit the correct transaction hash below.`
          : 'Our team will confirm your payment shortly. We’ll update this order once it’s approved.',
    },
    completed: {
      icon: <CheckCircle2Icon className="size-6" />,
      tone: 'bg-success-soft text-success',
      title: 'Purchase completed',
      text: order.hasCertificate
        ? 'Your share certificate is ready to download.'
        : 'Your shares have been allocated. Your share certificate will be available here once issued.',
    },
    rejected: {
      icon: <XCircleIcon className="size-6" />,
      tone: 'bg-danger-soft text-danger',
      title: 'Payment rejected',
      text: order.rejectionReason ?? 'Please contact support for details.',
    },
    cancelled: {
      icon: <XCircleIcon className="size-6" />,
      tone: 'bg-muted text-muted-foreground',
      title: 'Order cancelled',
      text: 'This order was cancelled before payment.',
    },
  }
  const s = map[order.status]
  if (!s) return null
  return (
    <div className="flex items-start gap-4">
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full', s.tone)}>{s.icon}</span>
      <div className="space-y-1">
        <p className="text-title font-bold">{s.title}</p>
        <p className="text-caption text-muted-foreground">{s.text}</p>
        {order.status === 'completed' && order.hasCertificate && (
          <a href={trade.certificateUrl(order.id)} className={buttonVariants({ className: 'mt-3 gap-2' })}>
            <DownloadIcon />
            Download certificate
          </a>
        )}
      </div>
    </div>
  )
}

export default function OrderPaymentPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [config, setConfig] = useState(null)
  const [error, setError] = useState(null)
  const [method, setMethod] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    try {
      const [{ order }, cfg] = await Promise.all([trade.getOrder(id), trade.getTradeConfig()])
      setOrder(order)
      setConfig(cfg)
      setMethod((m) => m ?? order.paymentMethod ?? (cfg.paymentMethods.bep20 ? 'bep20' : cfg.paymentMethods.zelle ? 'zelle' : null))
    } catch (err) {
      setError(err)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Poll while the chain check is in progress
  useEffect(() => {
    if (order?.status !== 'verifying') return
    const timer = setInterval(async () => {
      const { order: updated } = await trade.refreshPayment(order.id).catch(() => ({ order }))
      setOrder(updated)
      if (updated.status === 'completed') toast.success('Payment verified — your purchase is complete')
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [order])

  const handleSubmitted = (updated) => {
    setOrder(updated)
    if (updated.status === 'completed') toast.success('Payment verified — your purchase is complete')
    else toast.success('Payment submitted')
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const { order: updated } = await trade.cancelOrder(order.id)
      setOrder(updated)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCancelling(false)
    }
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-title font-semibold">{error.status === 404 ? 'Order not found' : 'Couldn’t load this order'}</p>
        <Link to="/trade" className={buttonVariants({ variant: 'outline', className: 'mt-4' })}>
          Back to Trade
        </Link>
      </div>
    )
  }
  if (!order || !config) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  const status = ORDER_STATUS[order.status]
  const canPay = order.status === 'awaiting_payment' || (order.status === 'pending_review' && order.paymentMethod === 'bep20')
  const methods = [
    config.paymentMethods.bep20 && { value: 'bep20', label: 'USDT (BEP20)' },
    config.paymentMethods.zelle && { value: 'zelle', label: 'Zelle' },
  ].filter(Boolean)
  // A BEP20 retry stays on BEP20
  const methodOptions = order.status === 'pending_review' ? methods.filter((m) => m.value === 'bep20') : methods

  return (
    <>
      <PageHeader
        breadcrumb={['Investor Portal', 'Trade', order.orderCode]}
        title={canPay && order.status === 'awaiting_payment' ? 'Complete your payment' : 'Order details'}
        description={`Order ${order.orderCode} · created ${formatDate(order.createdAt)}`}
        action={<StatusBadge tone={status.tone} icon={order.status === 'completed'}>{status.label}</StatusBadge>}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[17.5px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel className="space-y-6 p-5 sm:p-[30px]">
          {order.status !== 'awaiting_payment' && <StatusPanel order={order} />}

          {canPay && (
            <div className="space-y-5">
              <PanelHeader
                title="Payment method"
                description="Choose how you want to pay for this order."
                action={
                  methodOptions.length > 1 && (
                    <SegmentedControl label="Payment method" options={methodOptions} value={method} onChange={setMethod} />
                  )
                }
              />
              {!methodOptions.length && <p className="text-caption text-muted-foreground">Payments are not available right now. Please contact support.</p>}
              {method === 'bep20' && config.paymentMethods.bep20 && (
                <Bep20Payment order={order} method={config.paymentMethods.bep20} onSubmitted={handleSubmitted} />
              )}
              {method === 'zelle' && config.paymentMethods.zelle && order.status === 'awaiting_payment' && (
                <ZellePayment order={order} method={config.paymentMethods.zelle} onSubmitted={handleSubmitted} />
              )}
            </div>
          )}

          {order.status === 'awaiting_payment' && (
            <div className="border-t border-divider pt-4 text-center">
              <Button variant="ghost" className="text-muted-foreground" onClick={handleCancel} disabled={cancelling}>
                {cancelling && <Spinner />}
                Cancel this order
              </Button>
            </div>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center gap-[13.75px] border-b border-divider pb-[21.25px]">
            <span className="flex size-[42.5px] items-center justify-center rounded-lg bg-primary-soft text-primary">
              <FileTextIcon className="size-[25px]" />
            </span>
            <div>
              <h2 className="text-subheading font-bold">Order summary</h2>
              <p className="pt-[6.25px] text-caption text-muted-foreground">{order.orderCode}</p>
            </div>
          </div>
          <dl className="pt-2">
            <Row label="Class">
              <span className="inline-flex items-center gap-2">
                <ShareSwatch type={order.shareType} />
                Class {order.shareType}
              </span>
            </Row>
            <Row label="Shares">{formatInt(order.shares)}</Row>
            <Row label="Price">{formatUsdt(order.price)} USDT / Share</Row>
            <Row label="Transaction fee">
              <span className="text-success">0 USDT</span>
            </Row>
            <Row label="Total payment">
              <span className="text-title">{formatUsdt(order.amount)} USDT</span>
            </Row>
            {order.paymentMethod && <Row label="Payment method">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</Row>}
            {order.txHash && (
              <Row label="Transaction">
                <a href={bscscanTxUrl(order.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {order.txHash.slice(0, 10)}…{order.txHash.slice(-8)}
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </Row>
            )}
            {order.zelleReference && <Row label="Zelle confirmation">{order.zelleReference}</Row>}
            {order.completedAt && <Row label="Completed">{formatDate(order.completedAt)}</Row>}
          </dl>
          <Link to="/trade" className={buttonVariants({ variant: 'outline', className: 'mt-4 h-[50px] w-full gap-2 bg-card text-title font-bold' })}>
            <WalletIcon className="size-5" />
            Buy more shares
          </Link>
        </Panel>
      </div>
    </>
  )
}
