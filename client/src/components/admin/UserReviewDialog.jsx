import { useEffect, useState } from 'react'
import { AlertTriangleIcon, ExternalLinkIcon, LockIcon, PlusIcon, ScanFaceIcon, LockOpenIcon, MailCheckIcon, MailWarningIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import AdjustBalanceDialog from '@/components/admin/AdjustBalanceDialog'
import ManualPurchaseDialog from '@/components/admin/ManualPurchaseDialog'
import UserNetwork from '@/components/admin/UserNetwork'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { ACCOUNT_STATUS, DOCUMENT_TYPE_LABEL, KYC_STATUS } from '@/lib/adminUsers'
import { formatDate, formatDateTime, formatShares, formatUsdt } from '@/lib/format'
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
  // Hide the tile if the image is missing (e.g. the FaceTec host has no photo for that scan)
  const [failedUrl, setFailedUrl] = useState(null)
  if (failedUrl === url) return null
  return (
    <figure className="space-y-1">
      <a href={url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border bg-muted">
        <img src={url} alt={label} className="aspect-[3/2] w-full object-contain" onError={() => setFailedUrl(url)} />
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
  const { can } = useAdminAuth()
  const canManage = can('users:manage')
  const [user, setUser] = useState(null)
  // Opening a member from the network list stacks their profile on top; Back returns to the previous one
  const [trail, setTrail] = useState([])
  const currentId = trail.at(-1) ?? userId
  const [busy, setBusy] = useState(null)
  const [mode, setMode] = useState(null) // 'reject' | 'lock' | 'delete' | 'faceReject' while asking for a reason
  const [editingReferrer, setEditingReferrer] = useState(false)
  const [buying, setBuying] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [confirmingVerify, setConfirmingVerify] = useState(false)
  const [referrerCode, setReferrerCode] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => setTrail([]), [userId])

  useEffect(() => {
    if (!currentId) return
    setUser(null)
    setMode(null)
    setReason('')
    setEditingReferrer(false)
    setConfirmingVerify(false)
    adminService
      .getUser(currentId)
      .then(({ data }) => setUser(data))
      .catch((err) => {
        toast.error(err.message)
        onClose()
      })
  }, [currentId, onClose])

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
  const deleted = !!user?.deletedAt
  const canBuy = can('orders:manage') && !deleted && user?.status === 'approved'
  const photosComplete = !!(user?.identity?.frontImage && user?.identity?.backImage && user?.identity?.supportingImage)

  /** Reload the profile (holdings and wallet) after something that changes them. */
  const reloadUser = () =>
    adminService.getUser(currentId).then(({ data }) => setUser(data)).catch(() => {})

  const saveReferrer = async () => {
    setBusy('referrer')
    try {
      const { data } = await adminService.changeUserReferrer(user._id, referrerCode.trim())
      setUser((prev) => ({ ...prev, referredBy: data.referredBy }))
      setEditingReferrer(false)
      toast.success('Referrer updated')
      onChanged?.()
    } catch (err) {
      toast.error(err.details?.referralCode ?? err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        {!user ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <>
            {trail.length > 0 && (
              <button type="button" onClick={() => setTrail((t) => t.slice(0, -1))} className="-mb-2 self-start text-caption font-semibold text-primary hover:underline">
                ← Back
              </button>
            )}
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
                <Row label="Email verified">{user.emailVerified ? 'Yes' : 'No'}</Row>
                <Row label="Referral code">{user.referralCode}</Row>
                <Row label="Referred by">
                  {editingReferrer ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Input
                        value={referrerCode}
                        onChange={(e) => setReferrerCode(e.target.value.toUpperCase())}
                        placeholder="New referral code (empty = none)"
                        className="h-9 w-56"
                        autoFocus
                      />
                      <Button size="sm" onClick={saveReferrer} disabled={busy === 'referrer'}>
                        {busy === 'referrer' && <Spinner />}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingReferrer(false)} disabled={busy === 'referrer'}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      {user.referredBy ? `${user.referredBy.fullName} (${user.referredBy.referralCode})` : '—'}
                      {canManage && !deleted && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline"
                          onClick={() => {
                            setReferrerCode(user.referredBy?.referralCode ?? '')
                            setEditingReferrer(true)
                          }}
                        >
                          <PencilIcon className="size-3" />
                          Change
                        </button>
                      )}
                    </span>
                  )}
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

            {user.holdings && (
              <section className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-3.5 py-2.5">
                  <h3 className="text-sm font-semibold">Share holdings</h3>
                  {can('orders:manage') && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canBuy}
                      title={canBuy ? undefined : 'Only KYC-approved users can hold shares'}
                      onClick={() => setBuying(true)}
                    >
                      <PlusIcon />
                      Manual purchase
                    </Button>
                  )}
                </div>
                <dl className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
                  {[
                    ['Class A', user.holdings.A],
                    ['Class B', user.holdings.B],
                  ].map(([label, h]) => (
                    <div key={label} className="bg-card px-3.5 py-3">
                      <dt className="text-caption text-muted-foreground">{label}</dt>
                      <dd className="pt-0.5 text-title font-bold tabular-nums">{formatShares(h.shares)} <span className="text-caption font-medium text-muted-foreground">shares</span></dd>
                      <dd className="text-caption text-muted-foreground tabular-nums">
                        Invested {formatUsdt(h.invested)} · Value {formatUsdt(h.value)} USDT
                      </dd>
                    </div>
                  ))}
                  <div className="bg-muted/40 px-3.5 py-3">
                    <dt className="text-caption text-muted-foreground">Total</dt>
                    <dd className="pt-0.5 text-title font-bold tabular-nums">{formatShares(user.holdings.totalShares)} <span className="text-caption font-medium text-muted-foreground">shares</span></dd>
                    <dd className="text-caption text-muted-foreground tabular-nums">
                      Invested {formatUsdt(user.holdings.totalInvested)} · Value {formatUsdt(user.holdings.totalValue)} USDT
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            {user.wallet && (
              <section className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-3.5 py-2.5">
                  <h3 className="text-sm font-semibold">
                    Commission wallet <span className="text-caption font-normal text-muted-foreground">USDT</span>
                  </h3>
                  {can('referrals:manage') && !deleted && (
                    <Button size="sm" variant="outline" onClick={() => setAdjusting(true)}>
                      <PencilIcon />
                      Adjust balance
                    </Button>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                  {[
                    ['Available', user.wallet.available, 'text-success'],
                    ['Pending KYC', user.wallet.pending, user.wallet.pending > 0 ? 'text-warning' : ''],
                    ['Requested', user.wallet.requested, ''],
                    ['Withdrawn', user.wallet.withdrawn, ''],
                  ].map(([label, value, tone]) => (
                    <div key={label} className="bg-card px-3.5 py-3">
                      <dt className="text-caption text-muted-foreground">{label}</dt>
                      <dd className={`pt-0.5 text-title font-bold tabular-nums ${tone}`}>{formatUsdt(value)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="border-t px-3.5 py-2.5 text-caption text-muted-foreground">
                  Total earned <span className="font-semibold text-foreground">{formatUsdt(user.wallet.earned)} USDT</span> · Withdrawal wallet:{' '}
                  {user.wallet.address ? <span className="font-mono break-all text-foreground">{user.wallet.address}</span> : <span>not set</span>}
                </p>
                {user.wallet.adjustments?.length > 0 && (
                  <div className="border-t px-3.5 py-2.5">
                    <p className="pb-1 text-caption font-semibold">Recent balance adjustments</p>
                    <ul className="space-y-1">
                      {user.wallet.adjustments.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-caption">
                          <span className="min-w-0 flex-1 text-muted-foreground">
                            {formatDate(a.date)} · {a.reason}
                            {a.by && <span> — {a.by}</span>}
                          </span>
                          <span className={`font-bold tabular-nums ${a.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                            {a.amount >= 0 ? '+' : '−'}
                            {formatUsdt(Math.abs(a.amount))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <UserNetwork key={user._id} userId={user._id} onOpenUser={(id) => setTrail((t) => [...t, id])} />

            {!user.emailVerified && !deleted && (
              <div className="space-y-2.5 rounded-lg border border-warning/30 bg-warning-soft p-3.5 text-sm">
                <p className="flex items-center gap-2 font-semibold text-warning">
                  <MailWarningIcon className="size-4" />
                  This user hasn’t confirmed their email yet
                </p>
                <p className="text-muted-foreground">
                  They can’t sign in until it is. If the verification email never reached them, you can verify it manually — only do this
                  once you’re sure the address belongs to them.
                </p>
                {canManage &&
                  (confirmingVerify ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={!!busy}
                        onClick={() => run('verify', () => adminService.verifyUserEmail(user._id), 'Email verified')}
                      >
                        {busy === 'verify' ? <Spinner /> : <MailCheckIcon />}
                        Yes, verify {user.email}
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setConfirmingVerify(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConfirmingVerify(true)}>
                      <MailCheckIcon />
                      Verify email manually
                    </Button>
                  ))}
              </div>
            )}

            {deleted && (
              <div className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
                <p className="font-semibold">This user was deleted on {formatDate(user.deletedAt)}.</p>
                {user.deletedSnapshot?.email && (
                  <p>
                    Former email {user.deletedSnapshot.email} and phone {user.deletedSnapshot.phone} can be used for a new account.
                  </p>
                )}
                {user.deletedSnapshot?.reason && <p>Reason: {user.deletedSnapshot.reason}</p>}
              </div>
            )}

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
                {user.identity?.supportingImage && <DocImage userId={user._id} side="supporting" label="Holding the document" />}
              </div>
              {!photosComplete && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-caption text-[#75521d]">
                  <AlertTriangleIcon className="mt-px size-4 shrink-0 text-warning" />
                  <span>
                    <span className="font-bold">All 3 photos are needed before this account can be approved</span> — document front, document back, and a photo of the user holding the document. Missing:{' '}
                    {[!user.identity?.frontImage && 'front', !user.identity?.backImage && 'back', !user.identity?.supportingImage && 'photo holding the document'].filter(Boolean).join(', ')}. The user has been asked to add it in Account &amp; Security.
                  </span>
                </p>
              )}
            </section>

            {(user.face?.status ?? 'none') !== 'none' && (
              <section className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-3.5 py-2.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <ScanFaceIcon className="size-4" />
                    Face scan
                  </h3>
                  <StatusBadge
                    tone={{ pending: 'warning', approved: 'success', rejected: 'danger' }[user.face.status]}
                    icon={false}
                    className="h-6"
                  >
                    {{ pending: 'Awaiting review', approved: 'Approved', rejected: 'Rejected' }[user.face.status]}
                  </StatusBadge>
                </div>
                <div className="grid gap-4 p-3.5 sm:grid-cols-[180px_1fr]">
                  {user.face.hasImage || user.faceTecTid ? (
                    <DocImage userId={user._id} side="face" label="Face scan" />
                  ) : (
                    <div className="flex aspect-[3/2] items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ScanFaceIcon className="size-8" />
                    </div>
                  )}
                  <div className="space-y-3 text-sm">
                    <div className="space-y-1">
                      <p>
                        <span className="text-muted-foreground">Face registered: </span>
                        <span className="font-semibold">{user.face.submittedAt ? formatDateTime(user.face.submittedAt) : '—'}</span>
                      </p>
                      {user.ageEstimate != null && (
                        <p>
                          <span className="text-muted-foreground">Estimated age: </span>
                          <span className="font-semibold">{Math.round(user.ageEstimate)}</span>
                        </p>
                      )}
                      {user.face.status === 'approved' && <p className="text-muted-foreground">Approved{user.face.reviewedAt ? ` on ${formatDate(user.face.reviewedAt)}` : ''}.</p>}
                      {user.face.status === 'rejected' && (
                        <p className="text-muted-foreground">Rejected{user.face.rejectionReason ? `: ${user.face.rejectionReason}` : ''}. The user can scan again.</p>
                      )}
                    </div>
                    {canManage && !deleted && user.face.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={!!busy || !photosComplete} title={photosComplete ? undefined : 'All 3 identity photos are required first'} onClick={() => run('faceApprove', () => adminService.approveFace(user._id), 'Face scan approved')}>
                          {busy === 'faceApprove' && <Spinner />}
                          Approve face scan
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" disabled={!!busy} onClick={() => setMode('faceReject')}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {mode && canManage && (
              <div className="space-y-2">
                <label htmlFor="action-reason" className="text-sm font-semibold">
                  {mode === 'reject' || mode === 'faceReject' ? 'Rejection reason (shown to the user)' : mode === 'delete' ? 'Deletion reason (internal, optional)' : 'Lock reason (internal, optional)'}
                </label>
                <Textarea id="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
              </div>
            )}

{canManage && !deleted && (
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
              {mode ? (
                <>
                  <Button variant="outline" onClick={() => setMode(null)} disabled={!!busy}>
                    Cancel
                  </Button>
                  <Button
                    className="sm:ml-auto"
                    disabled={!!busy || ((mode === 'reject' || mode === 'faceReject') && !reason.trim())}
                    variant={mode === 'delete' ? 'destructive' : 'default'}
                    onClick={() =>
                      mode === 'faceReject'
                        ? run('faceReject', () => adminService.rejectFace(user._id, reason.trim()), 'Face scan rejected')
                        : mode === 'reject'
                        ? run('reject', () => adminService.rejectUser(user._id, reason.trim()), 'Application rejected')
                        : mode === 'delete'
                          ? run('delete', () => adminService.deleteUser(user._id, reason.trim() || undefined), 'User deleted')
                          : run('lock', () => adminService.lockUser(user._id, reason.trim() || undefined), 'Account locked')
                    }
                  >
                    {busy && <Spinner />}
                    {mode === 'reject' || mode === 'faceReject' ? 'Confirm rejection' : mode === 'delete' ? 'Confirm deletion' : 'Confirm lock'}
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
                  <Button variant="outline" className="text-destructive" disabled={!!busy} onClick={() => setMode('delete')}>
                    <Trash2Icon />
                    Delete user
                  </Button>
                  <div className="flex gap-2 sm:ml-auto">
                    {user.status !== 'rejected' && (
                      <Button variant="destructive" className="flex-1" disabled={!!busy} onClick={() => setMode('reject')}>
                        Reject
                      </Button>
                    )}
                    {user.status !== 'approved' && user.emailVerified && (
                      <Button
                        className="flex-1"
                        disabled={!!busy || !photosComplete}
                        title={photosComplete ? undefined : 'All 3 identity photos are required first'}
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
)}
          </>
        )}
      </DialogContent>
      {user && adjusting && (
        <AdjustBalanceDialog
          user={user}
          onClose={() => setAdjusting(false)}
          onDone={() => {
            setAdjusting(false)
            reloadUser()
            onChanged?.()
          }}
        />
      )}
      {user && buying && (
        <ManualPurchaseDialog
          open
          user={user}
          onClose={() => setBuying(false)}
          onCreated={() => {
            setBuying(false)
            reloadUser()
            onChanged?.()
          }}
        />
      )}
    </Dialog>
  )
}
