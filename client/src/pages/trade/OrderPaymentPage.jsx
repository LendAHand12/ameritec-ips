import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import CopyButton from '@/components/CopyButton'
import PageHeader from '@/components/PageHeader'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import SegmentedControl from '@/components/dashboard/SegmentedControl'
import { ShareSwatch } from '@/components/dashboard/ShareMarker'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatDate, formatUsdt, formatShares } from '@/lib/format'
import { ORDER_STATUS, PAYMENT_METHOD_LABEL, bscscanTxUrl } from '@/lib/orders'
import { cn } from '@/lib/utils'
import { walletConfigured } from '@/lib/wallet-config'
import * as trade from '@/services/trade.service'

// The wallet libraries are heavy: only load them on this page, and only when a project ID is set
const WalletPayment = lazy(() => import('@/components/trade/WalletPayment'))

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

function UsdtPayment({ order, method, onStarted, onSubmitted }) {
  // Picking USDT moves the order to "paying" (once), then the wallet list opens
  const started = useRef(false)
  useEffect(() => {
    if (order.status !== 'awaiting_payment' || started.current) return
    started.current = true
    trade
      .startPayment(order.id)
      .then(({ order: updated }) => onStarted(updated))
      .catch((err) => toast.error(err.message))
  }, [order.id, order.status, onStarted])

  if (!walletConfigured) {
    return <p className="rounded-lg bg-muted p-4 text-caption text-muted-foreground">Wallet payments are not set up yet. Please contact support.</p>
  }

  return (
    <div className="space-y-5">
      <Suspense fallback={<Spinner className="mx-auto size-5 text-muted-foreground" />}>
        <WalletPayment order={order} method={method} onSubmitted={onSubmitted} autoOpen />
      </Suspense>
      <div className="flex items-start gap-[11.25px] rounded-lg bg-warning-soft p-[13.75px] text-caption text-[#75521d]">
        <AlertTriangleIcon className="size-[21.25px] shrink-0 text-warning" />
        <div className="space-y-1">
          <p className="font-bold">Pay on BNB Smart Chain (BEP20)</p>
          <p>Your wallet will be set to BNB Smart Chain and send exactly {formatUsdt(order.amount)} USDT in a single transfer. Keep a little BNB for the network fee.</p>
        </div>
      </div>
    </div>
  )
}

function ZellePayment({ order, onSubmitted }) {
  const [reference, setReference] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!confirmed) return
    setSubmitting(true)
    try {
      const { order: updated } = await trade.submitPayment(order.id, { method: 'zelle', memoConfirmed: true, reference: reference.trim() || undefined })
      onSubmitted(updated)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <img src={trade.zelleQrUrl()} alt="Zelle QR code" className="size-[190px] shrink-0 rounded-xl border bg-white object-contain p-2" />
        <div className="min-w-0 flex-1 space-y-4">
          <p className="text-caption text-muted-foreground">Open your bank app, choose Zelle and scan this QR code to pay.</p>
          <CopyField label="Amount to send (USD)" value={formatUsdt(order.amount)} />
        </div>
      </div>

      {/* Mandatory: payments without the code in the note can't be matched or counted */}
      <div className="rounded-xl border-2 border-primary bg-primary-soft/50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-title font-bold text-primary">Required: put this transaction code in the transfer note</p>
            <CopyField label="Transaction code" value={order.orderCode} mono />
            <p className="text-caption text-foreground">
              Type <span className="font-bold">{order.orderCode}</span> in the Zelle <span className="font-bold">memo / note</span> field when you send the money.
              <span className="font-bold text-primary"> A transfer without this code will NOT be counted</span> and the order can’t be approved. The QR code only fills in the recipient, not the note.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-caption">
          <Checkbox className="mt-0.5" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
          <span>
            I sent <span className="font-bold">{formatUsdt(order.amount)} USD</span> by Zelle and wrote the code <span className="font-bold">{order.orderCode}</span> in the transfer note.
          </span>
        </label>
        <div className="space-y-1.5">
          <label htmlFor="reference" className="text-caption font-semibold">
            Zelle confirmation number <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input id="reference" size="lg" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} autoComplete="off" />
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={submitting || !confirmed}>
          {submitting && <Spinner className="size-5" />}
          I’ve paid
        </Button>
        <p className="text-center text-caption text-subtle">Our team checks the note and confirms your payment, usually within 1 business day.</p>
      </form>
    </div>
  )
}

function StatusPanel({ order }) {
  const map = {
    paying: {
      icon: <WalletIcon className="size-6" />,
      tone: 'bg-warning-soft text-warning',
      title: 'Paying with your wallet',
      text: 'Pick your wallet, connect it and confirm the transfer. Your purchase completes as soon as the payment is sent.',
    },
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
          ? `We couldn’t verify this transaction automatically: ${order.paymentError}. Our team will review it shortly.`
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
        {order.status === 'completed' && order.hasCertificate && <CertificatePreview order={order} />}
      </div>
    </div>
  )
}

/** The share certificate shown in place: an image directly, a PDF in a frame. */
function CertificatePreview({ order }) {
  const src = `${trade.certificateUrl(order.id)}?inline=1`
  const isPdf = order.certificateMime === 'application/pdf'
  return (
    <div className="mt-4 overflow-hidden rounded-lg border bg-muted">
      {isPdf ? (
        <iframe src={src} title="Share certificate" className="h-[560px] w-full bg-card" />
      ) : (
        <a href={src} target="_blank" rel="noreferrer">
          <img src={src} alt={`Share certificate for order ${order.code ?? ''}`} className="mx-auto max-h-[560px] w-full object-contain" />
        </a>
      )}
    </div>
  )
}

export default function OrderPaymentPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const preferredMethod = searchParams.get('method')
  const [order, setOrder] = useState(null)
  const [config, setConfig] = useState(null)
  const [error, setError] = useState(null)
  const [method, setMethod] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    try {
      const [{ order }, cfg] = await Promise.all([trade.getOrder(id), trade.getTradeConfig()])
      // A slower, duplicate load must never overwrite a newer state (e.g. the order just moved to "paying")
      setOrder((prev) => prev ?? order)
      setConfig(cfg)
      const preferred = cfg.paymentMethods[preferredMethod] ? preferredMethod : null
      setMethod((m) => m ?? order.paymentMethod ?? preferred ?? (cfg.paymentMethods.bep20 ? 'bep20' : cfg.paymentMethods.zelle ? 'zelle' : null))
    } catch (err) {
      setError(err)
    }
  }, [id, preferredMethod])

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
  const canPay = order.status === 'awaiting_payment' || order.status === 'paying'
  const methods = [
    config.paymentMethods.bep20 && { value: 'bep20', label: 'USDT (BEP20)' },
    config.paymentMethods.zelle && { value: 'zelle', label: 'Zelle' },
  ].filter(Boolean)
  const methodOptions = methods

  return (
    <>
      <PageHeader
        breadcrumb={['Investor Portal', 'Trade', order.orderCode]}
        title={canPay ? 'Complete your payment' : 'Order details'}
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
                <UsdtPayment order={order} method={config.paymentMethods.bep20} onStarted={setOrder} onSubmitted={handleSubmitted} />
              )}
              {method === 'zelle' && config.paymentMethods.zelle && (
                <ZellePayment order={order} onSubmitted={handleSubmitted} />
              )}
            </div>
          )}

          {canPay && (
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
            <Row label="Shares">{formatShares(order.shares)}</Row>
            <Row label="Price">{formatUsdt(order.price)} USDT / Share</Row>
            <Row label="Transaction fee">
              <span className="text-success">0 USDT</span>
            </Row>
            <Row label={order.isConversion ? 'Order value' : 'Total payment'}>
              <span className="text-title">{formatUsdt(order.amount)} USDT</span>
            </Row>
            {order.isConversion ? (
              <Row label="Type">Share conversion</Row>
            ) : (
              order.paymentMethod && <Row label="Payment method">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</Row>
            )}
            {order.note && (
              <Row label="Note">
                <span className="block whitespace-pre-line">{order.note}</span>
              </Row>
            )}
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
