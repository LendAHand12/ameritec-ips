import { useState } from 'react'
import { ShieldCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DisableTwoFactorDialog, EnableTwoFactorDialog } from '@/components/account/SecurityDialogs'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import * as adminService from '@/services/admin.service'

const API = { setup: adminService.setupAdminTwoFactor, enable: adminService.enableAdminTwoFactor, disable: adminService.disableAdminTwoFactor }

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
      <div className="mt-[15px]">
        <h2 className="text-subheading font-semibold">Admin Security</h2>
        <p className="text-title text-muted-foreground">Protect your own administrator account.</p>
      </div>

      <article className="mt-[10px] flex flex-wrap items-center gap-4 rounded-[15px] border bg-card p-5 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
        <span className="flex size-[37.5px] shrink-0 items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
          <ShieldCheckIcon className="size-[21px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-subheading font-semibold">Two-Factor Authentication</h3>
          <p className="text-title text-muted-foreground">
            {enabled ? 'Signing in needs your password and a 6-digit code from your authenticator app.' : 'Add a 6-digit code from an authenticator app (such as Google Authenticator) to your sign-in.'}
          </p>
        </div>
        <StatusBadge tone={enabled ? 'success' : 'neutral'} icon={false} className="h-[29px]">
          {enabled ? 'Enabled' : 'Off'}
        </StatusBadge>
        <Button variant={enabled ? 'outline' : 'default'} className="h-[42.5px] px-[17.5px] text-title font-bold" onClick={() => setOpen(true)} disabled={!admin}>
          {enabled ? 'Turn off' : 'Turn on'}
        </Button>
      </article>

      {enabled ? (
        <DisableTwoFactorDialog key={`d-${open}`} open={open} onClose={() => setOpen(false)} onDisabled={done} api={API} />
      ) : (
        <EnableTwoFactorDialog key={`e-${open}`} open={open} onClose={() => setOpen(false)} onEnabled={done} api={API} />
      )}
    </>
  )
}
