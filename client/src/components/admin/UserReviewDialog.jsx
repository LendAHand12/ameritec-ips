import { useEffect, useState } from 'react'
import { ExternalLinkIcon, LockIcon, LockOpenIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { ACCOUNT_STATUS, DOCUMENT_TYPE_LABEL, KYC_STATUS } from '@/lib/adminUsers'
import { formatDate } from '@/lib/format'
import * as adminService from '@/services/admin.service'

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? '—'}</dd>
    </div>
  )
}

function DocImage({ userId, side, label }) {
  const url = adminService.identityImageUrl(userId, side)
  return (
    <figure className="space-y-1">
      <a href={url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border bg-muted">
        <img src={url} alt={label} className="aspect-[3/2] w-full object-contain" />
        <span className="absolute top-2 right-2 rounded-md bg-card/90 p-1 opacity-0 transition-opacity group-hover:opacity-100">
          <ExternalLinkIcon className="size-4" />
        </span>
      </a>
      <figcaption className="text-caption text-muted-foreground">{label}</figcaption>
    </figure>
  )
}

/** Review a user's KYC application: approve / reject, lock / unlock. */
export default function UserReviewDialog({ userId, onClose, onChanged }) {
  const [user, setUser] = useState(null)
  const [busy, setBusy] = useState(null)
  const [mode, setMode] = useState(null) // 'reject' | 'lock' while asking for a reason
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!userId) return
    setUser(null)
    setMode(null)
    setReason('')
    adminService
      .getUser(userId)
      .then(({ data }) => setUser(data))
      .catch((err) => {
        toast.error(err.message)
        onClose()
      })
  }, [userId, onClose])

  const run = async (key, action, successMessage) => {
    setBusy(key)
    try {
      const { data } = await action()
      setUser((prev) => ({ ...prev, ...data, referredBy: prev.referredBy, reviewedBy: prev.reviewedBy }))
      setMode(null)
      setReason('')
      toast.success(successMessage)
      onChanged?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  const kyc = user && KYC_STATUS[user.status]
  const account = user && ACCOUNT_STATUS[user.accountStatus]
  const locked = user?.accountStatus === 'locked'

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        {!user ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-subheading font-bold">{user.fullName}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{user.applicationId}</span>
                <StatusBadge tone={kyc.tone} icon={false}>{kyc.label}</StatusBadge>
                <StatusBadge tone={account.tone} icon={false}>{account.label}</StatusBadge>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-x-8 sm:grid-cols-2">
              <dl>
                <Row label="Email">{user.email}</Row>
                <Row label="Phone">{user.phone}</Row>
                <Row label="Referral code">{user.referralCode}</Row>
                <Row label="Referred by">
                  {user.referredBy ? `${user.referredBy.fullName} (${user.referredBy.referralCode})` : null}
                </Row>
              </dl>
              <dl>
                <Row label="Registered">{formatDate(user.createdAt)}</Row>
                <Row label="KYC submitted">{user.emailVerifiedAt && formatDate(user.emailVerifiedAt)}</Row>
                <Row label="Two-factor">{user.twoFactor?.enabled ? 'Enabled' : 'Disabled'}</Row>
                <Row label="Reviewed">
                  {user.reviewedAt && `${formatDate(user.reviewedAt)}${user.reviewedBy ? ` by ${user.reviewedBy.fullName}` : ''}`}
                </Row>
              </dl>
            </div>

            {(user.rejectionReason || user.lockedReason) && (
              <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                {user.rejectionReason && (
                  <p>
                    <span className="font-semibold">Rejection reason:</span> {user.rejectionReason}
                  </p>
                )}
                {locked && user.lockedReason && (
                  <p>
                    <span className="font-semibold">Lock reason:</span> {user.lockedReason}
                  </p>
                )}
              </div>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Identity document · {DOCUMENT_TYPE_LABEL[user.identity?.documentType] ?? '—'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {user.identity?.frontImage && <DocImage userId={user._id} side="front" label="Front" />}
                {user.identity?.backImage && <DocImage userId={user._id} side="back" label="Back" />}
                {user.identity?.supportingImage && <DocImage userId={user._id} side="supporting" label="Supporting certificate" />}
              </div>
            </section>

            {mode && (
              <div className="space-y-2">
                <label htmlFor="action-reason" className="text-sm font-semibold">
                  {mode === 'reject' ? 'Rejection reason (shown to the user)' : 'Lock reason (internal, optional)'}
                </label>
                <Textarea id="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
              {mode ? (
                <>
                  <Button variant="outline" onClick={() => setMode(null)} disabled={!!busy}>
                    Cancel
                  </Button>
                  <Button
                    className="sm:ml-auto"
                    disabled={!!busy || (mode === 'reject' && !reason.trim())}
                    onClick={() =>
                      mode === 'reject'
                        ? run('reject', () => adminService.rejectUser(user._id, reason.trim()), 'Application rejected')
                        : run('lock', () => adminService.lockUser(user._id, reason.trim() || undefined), 'Account locked')
                    }
                  >
                    {busy && <Spinner />}
                    {mode === 'reject' ? 'Confirm rejection' : 'Confirm lock'}
                  </Button>
                </>
              ) : (
                <>
                  {locked ? (
                    <Button variant="outline" disabled={!!busy} onClick={() => run('unlock', () => adminService.unlockUser(user._id), 'Account unlocked')}>
                      {busy === 'unlock' ? <Spinner /> : <LockOpenIcon />}
                      Unlock account
                    </Button>
                  ) : (
                    <Button variant="outline" disabled={!!busy} onClick={() => setMode('lock')}>
                      <LockIcon />
                      Lock account
                    </Button>
                  )}
                  <div className="flex gap-2 sm:ml-auto">
                    {user.status !== 'rejected' && (
                      <Button variant="destructive" className="flex-1" disabled={!!busy} onClick={() => setMode('reject')}>
                        Reject
                      </Button>
                    )}
                    {user.status !== 'approved' && (
                      <Button
                        className="flex-1"
                        disabled={!!busy}
                        onClick={() => run('approve', () => adminService.approveUser(user._id), 'Application approved')}
                      >
                        {busy === 'approve' && <Spinner />}
                        Approve
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
