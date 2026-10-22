import { useState } from 'react'
import { CheckIcon, KeyRoundIcon, LockKeyholeIcon, QrCodeIcon, ShieldAlertIcon, ShieldCheckIcon, SmartphoneIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DisableTwoFactorDialog, EnableTwoFactorDialog } from '@/components/account/SecurityDialogs'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { cn } from '@/lib/utils'
import * as adminService from '@/services/admin.service'

const API = { setup: adminService.setupAdminTwoFactor, enable: adminService.enableAdminTwoFactor, disable: adminService.disableAdminTwoFactor }

const BENEFITS = [
  'A stolen or guessed password alone can’t open your admin account.',
  'Protects approvals, balance changes and every other sensitive action you can perform.',
  'Works offline — codes come from the app on your phone and change every 30 seconds.',
]

const SETUP_STEPS = [
  { icon: SmartphoneIcon, title: 'Get an authenticator app', text: 'Install Google Authenticator (or Authy, Microsoft Authenticator) on your phone.' },
  { icon: QrCodeIcon, title: 'Scan the QR code', text: 'Confirm your password, then scan the code we show you.' },
  { icon: KeyRoundIcon, title: 'Enter the 6-digit code', text: 'Type the code from the app once to finish. That’s it.' },
]

/** Settings → Security: two-factor sign-in for the admin who is signed in. */
export default function AdminSecurityTab() {
  const { admin, refresh } = useAdminAuth()
  const [open, setOpen] = useState(false)
  const enabled = !!admin?.twoFactor?.enabled

  const done = async () => {
    setOpen(false)
    await refresh()
  }

  return (
    <>
      <div className="mt-[15px] grid items-stretch gap-[10px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Status */}
        <article className="flex flex-col rounded-[15px] border bg-card p-6 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                'flex size-14 shrink-0 items-center justify-center rounded-full ring-8 transition-colors',
                enabled ? 'bg-success-soft text-success ring-success-soft/50' : 'bg-warning-soft text-warning ring-warning-soft/50',
              )}
            >
              {enabled ? <ShieldCheckIcon className="size-7" /> : <ShieldAlertIcon className="size-7" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Two-factor authentication</p>
              <h2 className="pt-0.5 text-subheading font-bold">{enabled ? 'Your account is protected' : 'Add a second layer of security'}</h2>
              <p className="pt-1 text-title text-muted-foreground">
                {enabled
                  ? 'Signing in needs your password and a 6-digit code from your authenticator app.'
                  : 'Right now only your password stands between an attacker and the admin portal. Turn on 2FA with Google Authenticator.'}
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-2.5">
            {BENEFITS.map((text) => (
              <li key={text} className="flex items-start gap-2.5 text-title text-muted-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckIcon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
            <Button
              variant={enabled ? 'outline' : 'default'}
              className={cn('h-[46px] px-6 text-title font-bold', enabled ? 'bg-card' : 'shadow-brand')}
              onClick={() => setOpen(true)}
              disabled={!admin}
            >
              {enabled ? 'Turn off 2FA' : 'Turn on 2FA'}
            </Button>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold', enabled ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground')}>
              <span className={cn('size-2 rounded-full', enabled ? 'bg-success' : 'bg-subtle')} aria-hidden />
              {enabled ? 'Enabled' : 'Not enabled'}
            </span>
          </div>
        </article>

        {/* How it works */}
        <article className="rounded-[15px] border bg-card p-6 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
          <h3 className="flex items-center gap-2 text-title font-bold">
            <LockKeyholeIcon className="size-5 text-primary" />
            {enabled ? 'How it works for you' : 'How to turn it on'}
          </h3>

          {enabled ? (
            <ol className="mt-5 space-y-5">
              {[
                ['Sign in as usual', 'Enter your email and password.'],
                ['Enter your code', 'Open the authenticator app and type the current 6-digit code.'],
                ['Turning it off', 'Needs your password and a current code — a stolen session can’t weaken your account.'],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption font-bold text-primary">{i + 1}</span>
                  <span>
                    <span className="block text-title font-semibold">{title}</span>
                    <span className="block text-caption text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="mt-5 space-y-5">
              {SETUP_STEPS.map(({ icon, title, text }, i) => {
                const Icon = icon
                return (
                  <li key={title} className="flex gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-title font-semibold">
                        <span className="text-muted-foreground">{i + 1}. </span>
                        {title}
                      </span>
                      <span className="block text-caption text-muted-foreground">{text}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </article>
      </div>

      {enabled ? (
        <DisableTwoFactorDialog key={`d-${open}`} open={open} onClose={() => setOpen(false)} onDisabled={done} api={API} />
      ) : (
        <EnableTwoFactorDialog key={`e-${open}`} open={open} onClose={() => setOpen(false)} onEnabled={done} api={API} />
      )}
    </>
  )
}
