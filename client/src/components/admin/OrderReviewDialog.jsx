import { useEffect, useRef, useState } from 'react'
import { ExternalLinkIcon, FileUpIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatDate, formatUsdt, formatShares } from '@/lib/format'
import { ORDER_STATUS, PAYMENT_METHOD_LABEL, bscscanTxUrl } from '@/lib/orders'
import * as adminService from '@/services/admin.service'

const OPEN = ['awaiting_payment', 'paying', 'verifying', 'pending_review']

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? '—'}</dd>
    </div>
  )
}

/** Review a share purchase: approve / reject payment, upload the share certificate. */
export default function OrderReviewDialog({ orderId, onClose, onChanged }) {
  const { can } = useAdminAuth()
  const canManage = can('orders:manage')
  const [order, setOrder] = useState(null)
  const [busy, setBusy] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (!orderId) return
    setOrder(null)
    setRejecting(false)
    setReason('')
    adminService
      .getAdminOrder(orderId)
      .then(({ data }) => setOrder(data))
      .catch((err) => {
        toast.error(err.message)
        onClose()
      })
  }, [orderId, onClose])

  const run = async (key, action, message) => {
    setBusy(key)
    try {
      const { data } = await action()
      setOrder(data)
      setRejecting(false)
      toast.success(message)
      onChanged?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) run('upload', () => adminService.uploadCertificate(order.id, file), 'Certificate uploaded')
  }

  const status = order && ORDER_STATUS[order.status]
  const open = order && OPEN.includes(order.status)

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {!order ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-subheading font-bold">{order.orderCode}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={status.tone} icon={false}>
                  {status.label}
                </StatusBadge>
                <span>Created {formatDate(order.createdAt)}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-x-8 sm:grid-cols-2">
              <dl>
                <Row label="Investor">{order.user?.fullName}</Row>
                <Row label="Email">{order.user?.email}</Row>
                <Row label="Phone">{order.user?.phone}</Row>
                <Row label="Ref code">{order.user?.referralCode}</Row>
              </dl>
              <dl>
                <Row label="Class">Class {order.shareType}</Row>
                <Row label="Shares">{formatShares(order.shares)}</Row>
                <Row label="Price">{formatUsdt(order.price)} USDT</Row>
                <Row label="Total">
                  <span className="font-bold">{formatUsdt(order.amount)} USDT</span>
                </Row>
              </dl>
            </div>

            <section className="rounded-lg bg-muted p-3">
              <h3 className="mb-1 text-sm font-semibold">Payment</h3>
              <dl>
                <Row label="Method">{order.paymentMethod ? PAYMENT_METHOD_LABEL[order.paymentMethod] : 'Not paid yet'}</Row>
                {order.manual && (
                  <Row label="Created manually">
                    By an admin · referral commission {order.manual.commissionPaid ? 'paid' : 'not paid'}
                    {order.manual.reference && <span className="block text-muted-foreground">Reference: {order.manual.reference}</span>}
                    {order.manual.note && <span className="block text-muted-foreground">{order.manual.note}</span>}
                  </Row>
                )}
                {order.txHash && (
                  <Row label="Tx hash">
                    <a href={bscscanTxUrl(order.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-primary hover:underline">
                      {order.txHash}
                      <ExternalLinkIcon className="size-3.5 shrink-0" />
                    </a>
                  </Row>
                )}
                {order.paymentMethod === 'zelle' && (
                  <>
                    <Row label="Memo to match">{order.orderCode}</Row>
                    <Row label="Confirmation #">{order.zelleReference}</Row>
                  </>
                )}
                {order.paidAt && <Row label="Submitted">{formatDate(order.paidAt)}</Row>}
                {order.paymentError && <Row label="Verification">{order.paymentError}</Row>}
                {order.chainCheck && order.chainCheck.state !== 'verified' && (
                  <Row label="On-chain check">
                    <span className={order.chainCheck.state === 'invalid' ? 'font-semibold text-destructive' : 'text-warning'}>
                      {order.chainCheck.state === 'invalid' ? `Not verified — ${order.chainCheck.reason ?? 'transfer not found'}` : 'Still checking…'}
                    </span>
                  </Row>
                )}
                {order.chainCheck?.state === 'verified' && <Row label="On-chain check">Verified</Row>}
                {order.completedAt && (
                  <Row label="Completed">
                    {formatDate(order.completedAt)} · {order.completedBy === 'system' ? 'verified on-chain' : 'approved by admin'}
                  </Row>
                )}
                {order.rejectionReason && <Row label="Rejection reason">{order.rejectionReason}</Row>}
              </dl>
            </section>

            {order.paymentMethod === 'zelle' && order.status === 'pending_review' && (
              <div className="rounded-lg border-2 border-primary/40 bg-primary-soft/40 p-3 text-sm">
                <p className="font-bold text-primary">Check the Zelle transfer note</p>
                <p className="pt-1 text-muted-foreground">
                  Approve only if the transfer’s note contains <span className="font-mono font-bold text-foreground">{order.orderCode}</span> and the amount matches. A transfer without the code doesn’t count — reject it.
                </p>
              </div>
            )}

            {order.status === 'completed' && (
              <section className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">Share certificate</h3>
                  <p className="truncate text-caption text-muted-foreground">
                    {order.certificate ? `${order.certificate.originalName} · uploaded ${formatDate(order.certificate.uploadedAt)}` : 'Not uploaded yet'}
                  </p>
                </div>
                {order.certificate && (
                  <a href={adminService.adminCertificateUrl(order.id)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline' })}>
                    View
                  </a>
                )}
{canManage && (
                <>
                <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} />
                <Button onClick={() => fileRef.current?.click()} disabled={!!busy}>
                  {busy === 'upload' ? <Spinner /> : <FileUpIcon />}
                  {order.certificate ? 'Replace' : 'Upload certificate'}
                </Button>
                </>
)}
              </section>
            )}

            {open && rejecting && (
              <div className="space-y-2">
                <label htmlFor="reject-reason" className="text-sm font-semibold">
                  Rejection reason (shown to the investor)
                </label>
                <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
              </div>
            )}

            {open && canManage && (
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                {rejecting ? (
                  <>
                    <Button variant="outline" onClick={() => setRejecting(false)} disabled={!!busy}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!!busy || !reason.trim()}
                      onClick={() => run('reject', () => adminService.rejectOrder(order.id, reason.trim()), 'Order rejected')}
                    >
                      {busy === 'reject' && <Spinner />}
                      Confirm rejection
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="destructive" onClick={() => setRejecting(true)} disabled={!!busy}>
                      Reject
                    </Button>
                    <Button onClick={() => run('approve', () => adminService.approveOrder(order.id), 'Payment approved — order completed')} disabled={!!busy}>
                      {busy === 'approve' && <Spinner />}
                      Approve payment
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
