import { useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownToLineIcon, ArrowRightIcon, CheckIcon, KeyRoundIcon, ScanFaceIcon, LaptopIcon, LayoutGridIcon, MonitorIcon, ShieldCheckIcon, SmartphoneIcon, UserRoundIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import PageHeader from '@/components/PageHeader'
import { ChangePasswordDialog, EditContactDialog } from '@/components/account/AccountDialogs'
import { DisableTwoFactorDialog, EnableTwoFactorDialog } from '@/components/account/SecurityDialogs'
import { Panel } from '@/components/dashboard/Panel'
import { scoreLabel, securityChecks } from '@/components/dashboard/AccountStatusCard'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { DOCUMENT_TYPE_LABEL, KYC_STATUS } from '@/lib/adminUsers'
import { formatDate, formatDateTime, formatDateTime24 } from '@/lib/format'
import { cn } from '@/lib/utils'
import { faceImageUrl, getAccount, getSession, identityImageUrl, signOutOtherSessions, uploadIdentityPhoto } from '@/services/account.service'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_MB, validateImageFile } from '@/components/auth/DocumentUpload'
import SelfieSample, { SELFIE_SAMPLE_SRC } from '@/components/auth/SelfieSample'
import { startFaceScan } from '@/services/kyc.service'

const TABS = [
  { value: 'profile', label: 'Profile', icon: UserRoundIcon },
  { value: 'identity', label: 'Identity Verification', icon: ShieldCheckIcon },
  { value: 'security', label: 'Security', icon: CheckIcon },
  { value: 'sessions', label: 'Sessions', icon: LayoutGridIcon },
]

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/** "Chrome on Windows" from a user-agent string. */
function describeDevice(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown device'
  return { browser, os, mobile: /Android|iPhone|iPad|Mobile/.test(ua) }
}

function Verified({ children = 'Verified information' }) {
  return (
    <span className="mt-1.5 flex items-center gap-1.5 text-caption text-success">
      <ShieldCheckIcon className="size-3.5" />
      {children}
    </span>
  )
}

/** One bordered cell of the profile grid. */
function Cell({ label, children, className }) {
  return (
    <div className={cn('px-[18.75px] py-[15px]', className)}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="pt-1.5 text-title font-semibold break-words">{children}</dd>
    </div>
  )
}

function SectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider pb-[18.75px]">
      <div>
        <h2 className="text-subheading font-bold">{title}</h2>
        <p className="pt-[5px] text-caption text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function ProfileTab({ account, onEdit }) {
  const { profile } = account
  const status = profile.accountStatus === 'active' ? { label: 'Active', tone: 'success' } : { label: 'Locked', tone: 'danger' }
  return (
    <>
      <SectionHeader
        title="Profile"
        description="Your verified account and contact information."
        action={
          <Button variant="outline" className="h-[50px] bg-card px-5 text-title font-bold" onClick={onEdit}>
            Edit Contact Information
          </Button>
        }
      />
      <dl className="grid divide-divider md:grid-cols-2 md:[&>*:nth-child(odd)]:border-r md:[&>*]:border-b [&>*]:border-divider">
        <Cell label="Full Name">
          {profile.fullName}
          <Verified />
        </Cell>
        <Cell label="Email Address">
          {profile.email}
          {profile.emailVerified && <Verified>Email verified</Verified>}
        </Cell>
        <Cell label="Phone Number">{profile.phone}</Cell>
        <Cell label="Investor / Account ID">
          {profile.applicationId}
          <Verified />
        </Cell>
        <Cell label="Referral Code">{profile.referralCode}</Cell>
        <Cell label="Account Created">{formatDate(profile.createdAt)}</Cell>
        <Cell label="Account Status" className="md:col-span-2 md:!border-r-0">
          <StatusBadge tone={status.tone} icon={false} className="min-w-[200px] justify-start">
            {status.label}
          </StatusBadge>
        </Cell>
      </dl>
      <div className="mt-[18.75px] flex items-start gap-3 rounded-lg bg-primary-soft p-4">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-caption font-bold">Verified identity information</p>
          <p className="text-caption text-muted-foreground">Changes to identity-critical information may require additional verification.</p>
        </div>
      </div>
    </>
  )
}

const FACE_STATUS = {
  none: { label: 'Not added', tone: 'neutral' },
  pending: { label: 'Under review', tone: 'warning' },
  approved: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

const PHOTO_EXAMPLES = { front: '/kyc-sample-front.svg', back: '/kyc-sample-back.svg', selfie: SELFIE_SAMPLE_SRC }

function PhotoTile({ side, label, done, locked, version, busy, onPick, placeholderImage }) {
  const inputId = useId()
  const [failed, setFailed] = useState(false)
  const showImage = done && !failed
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-semibold">{label}</span>
        <span className={cn('text-caption font-semibold', done ? 'text-success' : 'text-primary')}>{done ? (locked ? 'Locked' : 'Submitted') : 'Required'}</span>
      </div>
      <label
        htmlFor={locked || busy ? undefined : inputId}
        className={cn(
          'relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border bg-muted text-center',
          !locked && !busy && 'cursor-pointer hover:border-primary',
          !done && 'border-dashed border-border-strong',
        )}
      >
        {showImage ? (
          <img src={identityImageUrl(side, version)} alt={label} className="size-full bg-card object-contain" onError={() => setFailed(true)} />
        ) : placeholderImage && !done ? (
          // An example of the photo wanted, so people can picture it before uploading
          <>
            {busy ? <Spinner /> : <img src={placeholderImage} alt="Example of the photo to upload" className="h-[55%] w-auto max-w-full object-contain" />}
            <span className="text-caption font-bold">Click to upload</span>
            <span className="text-caption text-subtle">JPG, PNG or WEBP · Max {MAX_IMAGE_SIZE_MB} MB</span>
          </>
        ) : (
          <>
            <span className="flex size-10 items-center justify-center rounded-full border bg-card text-primary">{busy ? <Spinner /> : <ArrowDownToLineIcon className="size-5" />}</span>
            <span className="text-caption font-bold">{done ? 'Couldn’t load the photo' : 'Click to upload'}</span>
            <span className="text-caption text-subtle">JPG, PNG or WEBP · Max {MAX_IMAGE_SIZE_MB} MB</span>
          </>
        )}
        {showImage && !locked && (
          <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-md bg-background/90 py-1 text-caption font-semibold text-primary shadow-sm backdrop-blur">
            {busy ? <Spinner className="size-3.5" /> : null}
            Click to replace
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="sr-only"
          disabled={locked || busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onPick(file)
          }}
        />
      </label>
    </div>
  )
}

/**
 * The 3 photos an account needs. While any is missing, the missing one can be uploaded and the others replaced;
 * once all 3 are submitted they are locked.
 */
function IdentityPhotos({ photos, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [version, setVersion] = useState(() => Date.now())
  const tiles = [
    ['front', 'Document front'],
    ['back', 'Document back'],
    ['selfie', 'Photo of you holding your document'],
  ]

  const upload = async (side, file) => {
    const message = validateImageFile(file)
    if (message) return toast.error(message)
    setBusy(side)
    try {
      const { photos: next } = await uploadIdentityPhoto(side, file)
      setVersion(Date.now())
      toast.success(next.complete ? 'All 3 photos submitted — they are now locked' : 'Photo saved')
      onChanged()
    } catch (err) {
      toast.error(err.details?.photo ?? err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-[18.75px] rounded-xl border p-[18.75px]">
      <p className="flex flex-wrap items-center gap-2 text-title font-bold">
        Identity photos
        <StatusBadge tone={photos.complete ? 'success' : 'warning'} icon={false} className="h-6">
          {photos.complete ? 'All 3 submitted' : 'Photo missing'}
        </StatusBadge>
      </p>
      <p className="pt-1 text-caption text-muted-foreground">
        {photos.locked
          ? 'All 3 photos are submitted and locked. They can’t be changed here — contact support if something is wrong.'
          : 'Your account can’t be approved until all 3 photos are submitted. Until then you can add the missing photo and replace the others. Once all 3 are in, they are locked.'}
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-3 sm:gap-6">
        {tiles.map(([side, label]) => (
          <PhotoTile key={side} side={side} label={label} done={photos[side]} locked={photos.locked} version={version} busy={busy === side} onPick={(file) => upload(side, file)} placeholderImage={PHOTO_EXAMPLES[side]} />
        ))}
      </div>
      {!photos.selfie && <SelfieSample showImage={false} className="mt-4 max-w-sm" />}
    </div>
  )
}

function IdentityTab({ account, onAddFace, startingFace, onChanged }) {
  const { identity, profile } = account
  const kyc = KYC_STATUS[profile.status]
  // Hidden if the photo can't be loaded (e.g. the face scan host is unreachable)
  const [faceImageFailed, setFaceImageFailed] = useState(false)
  return (
    <>
      <SectionHeader title="Identity Verification" description="The identity documents you submitted when you joined." />
      <dl className="grid md:grid-cols-2 md:[&>*:nth-child(odd)]:border-r md:[&>*]:border-b [&>*]:border-divider">
        <Cell label="Verification status">
          <StatusBadge tone={kyc.tone} icon={false}>
            {kyc.label}
          </StatusBadge>
        </Cell>
        <Cell label="Document type">{DOCUMENT_TYPE_LABEL[identity.documentType] ?? '—'}</Cell>
        <Cell label="Submitted">{formatDate(identity.submittedAt)}</Cell>
        <Cell label="Reviewed">{identity.reviewedAt ? formatDate(identity.reviewedAt) : 'Not reviewed yet'}</Cell>
      </dl>

      <IdentityPhotos photos={identity.photos} onChanged={onChanged} />

      <div className="mt-[18.75px] rounded-xl border p-[18.75px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-[46px] shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <ScanFaceIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-title font-bold">
              Face scan
              <StatusBadge tone={FACE_STATUS[identity.face.status].tone} icon={false} className="h-6">
                {FACE_STATUS[identity.face.status].label}
              </StatusBadge>
            </p>
            <p className="pt-1 text-caption text-muted-foreground">
              {identity.face.status === 'approved' && `Verified${identity.face.reviewedAt ? ` on ${formatDate(identity.face.reviewedAt)}` : ''}.`}
              {identity.face.status === 'pending' && `Submitted ${formatDate(identity.face.submittedAt)} — our team will review it shortly.`}
              {identity.face.status === 'rejected' && `Not approved${identity.face.rejectionReason ? `: ${identity.face.rejectionReason}` : ''}. Please take a new photo.`}
              {identity.face.status === 'none' && 'Optional for buying shares, but needed to withdraw commission — and the commission your referrer earns from your purchases is held until it’s approved. You’ll be taken to our secure face scan page and brought back here.'}
            </p>
          </div>
          {(identity.face.status === 'none' || identity.face.status === 'rejected') && (
            <Button className="font-semibold" onClick={onAddFace} disabled={startingFace}>
              {startingFace && <Spinner />}
              {identity.face.status === 'rejected' ? 'Try again' : 'Add face scan'}
            </Button>
          )}
        </div>
        {identity.face.hasImage && !faceImageFailed && (
          <figure className="mt-4 w-full max-w-[240px] space-y-1">
            <img
              src={faceImageUrl()}
              alt="Your face scan"
              className="aspect-[3/2] w-full rounded-lg border bg-muted object-contain"
              onError={() => setFaceImageFailed(true)}
            />
            {identity.face.submittedAt && <figcaption className="text-caption text-muted-foreground">Registered {formatDateTime(identity.face.submittedAt)}</figcaption>}
          </figure>
        )}
      </div>
      <div className="mt-[18.75px] flex items-start gap-3 rounded-lg bg-muted p-4">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <p className="text-caption text-muted-foreground">Identity documents are stored securely and can’t be viewed or edited here. To update them, contact support.</p>
      </div>
    </>
  )
}

function SecurityRow({ icon, title, text, action, badge }) {
  const Icon = icon
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-divider py-[18.75px] last:border-0">
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="size-[22px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-title font-bold">{title}</p>
        <p className="text-caption text-muted-foreground">{text}</p>
      </div>
      {badge}
      {action}
    </div>
  )
}

function SecurityTab({ account, onChangePassword, onToggleTwoFactor }) {
  const { security, profile } = account
  return (
    <>
      <SectionHeader title="Security" description="Protect your account and your commission wallet." />
      <div>
        <SecurityRow
          icon={KeyRoundIcon}
          title="Password"
          text={security.passwordChangedAt ? `Last changed ${formatDate(security.passwordChangedAt)}` : 'Use a strong password you don’t use anywhere else.'}
          action={
            <Button variant="outline" className="bg-card font-semibold" onClick={onChangePassword}>
              Change password
            </Button>
          }
        />
        <SecurityRow
          icon={SmartphoneIcon}
          title="Two-factor authentication"
          text={
            security.twoFactorEnabled
              ? 'A code from Google Authenticator is needed to sign in and to withdraw or change your wallet.'
              : 'Optional. Turn it on to also require a code from Google Authenticator when you sign in and withdraw.'
          }
          badge={
            <StatusBadge tone={security.twoFactorEnabled ? 'success' : 'neutral'} icon={false}>
              {security.twoFactorEnabled ? 'Enabled' : 'Off'}
            </StatusBadge>
          }
          action={
            <Button variant={security.twoFactorEnabled ? 'outline' : 'default'} className={security.twoFactorEnabled ? 'bg-card font-semibold' : 'font-semibold'} onClick={onToggleTwoFactor}>
              {security.twoFactorEnabled ? 'Turn off' : 'Turn on'}
            </Button>
          }
        />
        <SecurityRow
          icon={CheckIcon}
          title="Email verification"
          text={profile.email}
          badge={
            <StatusBadge tone={profile.emailVerified ? 'success' : 'warning'} icon={false}>
              {profile.emailVerified ? 'Verified' : 'Pending'}
            </StatusBadge>
          }
        />
      </div>
    </>
  )
}

function SessionsTab() {
  const [reloadKey, setReloadKey] = useState(0)
  const { data } = useAsync(getSession, [reloadKey])
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const signOutOthers = async () => {
    setBusy(true)
    try {
      await signOutOtherSessions()
      toast.success('Every other device was signed out')
      setConfirming(false)
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const device = data && describeDevice(data.current.userAgent ?? '')
  const DeviceIcon = device?.mobile ? SmartphoneIcon : LaptopIcon
  return (
    <>
      <SectionHeader title="Sessions" description="Where your account is signed in." />
      {!data ? (
        <Spinner className="mx-auto my-10 size-5 text-muted-foreground" />
      ) : (
        <div className="space-y-5 pt-5">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border p-[18.75px]">
            <span className="flex size-[46px] shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
              <DeviceIcon className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-title font-bold">
                {device.browser} on {device.os}
                <StatusBadge tone="success" icon={false} className="h-6">
                  This device
                </StatusBadge>
              </p>
              <p className="text-caption text-muted-foreground">
                IP {data.current.ip ?? '—'} · Signed in {data.current.signedInAt ? formatDateTime24(data.current.signedInAt) : '—'}
                {data.current.expiresAt && ` · Expires ${formatDate(data.current.expiresAt)}`}
              </p>
            </div>
            <MonitorIcon className="hidden size-5 text-subtle sm:block" aria-hidden />
          </div>

          <div className="rounded-xl border bg-muted/40 p-[18.75px]">
            <p className="text-title font-bold">Sign out of other devices</p>
            <p className="pt-1 text-caption text-muted-foreground">
              Lost a device or used a shared computer? This signs you out everywhere else immediately. You stay signed in here.
            </p>
            {confirming ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="destructive" onClick={signOutOthers} disabled={busy}>
                  {busy && <Spinner />}
                  Yes, sign out other devices
                </Button>
                <Button variant="outline" className="bg-card" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="mt-3 bg-card font-semibold" onClick={() => setConfirming(true)}>
                Sign out of other devices
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default function AccountPage() {
  const { user, refresh } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'profile'
  const [reloadKey, setReloadKey] = useState(0)
  const { data: account, error } = useAsync(getAccount, [reloadKey])
  const [dialog, setDialog] = useState(null) // 'contact' | 'password' | 'twofa'
  const [startingFace, setStartingFace] = useState(false)

  const checks = securityChecks(user)
  const score = scoreLabel(checks.filter((c) => c.ok).length / checks.length)
  const reload = () => {
    setDialog(null)
    setReloadKey((k) => k + 1)
  }
  // Hands the browser to the FaceTec page; it returns to /user/kyc-callback when the scan is done
  const beginFaceScan = async () => {
    setStartingFace(true)
    try {
      const { url } = await startFaceScan()
      window.location.assign(url)
    } catch (err) {
      toast.error(err.message)
      setStartingFace(false)
    }
  }
  // Two-factor changes how sensitive actions ask for confirmation everywhere, so refresh the signed-in user too
  const reloadAfterTwoFactor = async () => {
    await refresh()
    reload()
  }

  return (
    <>
      <PageHeader breadcrumb={['Investor Portal', 'Account & Security']} title="Account & Security" description="Manage your profile, sign-in security, and account preferences." />

      {error && <p className="text-destructive">Couldn’t load your account. Please try again.</p>}
      {!account && !error && (
        <div className="flex justify-center py-20">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      )}

      {account && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[17.5px] lg:grid-cols-[250px_minmax(0,1fr)]">
          <Panel className="p-[15px]">
            <div className="flex items-center gap-3 px-1 pb-[15px]">
              <span className="flex size-[45px] shrink-0 items-center justify-center rounded-full bg-brand-muted text-title font-bold text-white">{initials(account.profile.fullName)}</span>
              <div className="min-w-0">
                <p className="truncate text-caption font-bold">{account.profile.fullName}</p>
                <p className="truncate text-caption text-muted-foreground">{account.profile.applicationId}</p>
              </div>
            </div>
            <nav aria-label="Account sections" className="space-y-1">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = tab === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSearchParams(t.value === 'profile' ? {} : { tab: t.value }, { replace: true })}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-caption font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                      active ? 'bg-primary-soft text-primary' : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    <span className="flex-1">{t.label}</span>
                    <ArrowRightIcon className="size-4 opacity-60" />
                  </button>
                )
              })}
            </nav>
            <div className="mt-[15px] flex items-center gap-2.5 rounded-lg bg-success-soft p-3">
              <ShieldCheckIcon className="size-[22px] shrink-0 text-success" />
              <div className="text-caption">
                <p className="font-bold">Account protected</p>
                <p className={cn('text-muted-foreground')}>
                  Security score: <span className={cn('font-semibold', score.tone)}>{score.text}</span>
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="p-[25px]">
            {tab === 'profile' && <ProfileTab account={account} onEdit={() => setDialog('contact')} />}
            {tab === 'identity' && <IdentityTab account={account} onAddFace={beginFaceScan} startingFace={startingFace} onChanged={reload} />}
            {tab === 'security' && <SecurityTab account={account} onChangePassword={() => setDialog('password')} onToggleTwoFactor={() => setDialog('twofa')} />}
            {tab === 'sessions' && <SessionsTab />}
          </Panel>
        </div>
      )}

      <EditContactDialog key={`c-${dialog === 'contact'}`} open={dialog === 'contact'} onClose={() => setDialog(null)} onSaved={reload} />
      {account?.security.twoFactorEnabled ? (
        <DisableTwoFactorDialog key={`d2-${dialog === 'twofa'}`} open={dialog === 'twofa'} onClose={() => setDialog(null)} onDisabled={reloadAfterTwoFactor} />
      ) : (
        <EnableTwoFactorDialog key={`e2-${dialog === 'twofa'}`} open={dialog === 'twofa'} onClose={() => setDialog(null)} onEnabled={reloadAfterTwoFactor} />
      )}
      <ChangePasswordDialog key={`p-${dialog === 'password'}`} open={dialog === 'password'} onClose={() => setDialog(null)} onChanged={reload} />
    </>
  )
}
