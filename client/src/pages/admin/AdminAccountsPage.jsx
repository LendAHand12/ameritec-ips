import { useEffect, useState } from 'react'
import { KeyRoundIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { formatDateTime24 } from '@/lib/format'
import * as adminService from '@/services/admin.service'

const th = 'border-y border-divider bg-muted px-2.5 py-[11.25px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-2.5 py-[11.25px]'
const EMPTY = { fullName: '', email: '', password: '', permissions: [], isActive: true }

function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-caption font-semibold">{label}</span>
      {children}
      {error ? <span className="block text-sm text-destructive">{error}</span> : hint && <span className="block text-caption text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** One row per portal area with View / Manage checkboxes; Manage always includes View. */
function PermissionMatrix({ modules, value, onChange }) {
  const has = (p) => value.includes(p)
  const toggle = (module, level, on) => {
    const next = new Set(value)
    if (level === 'manage' && on) {
      next.add(`${module}:manage`)
      next.add(`${module}:view`)
    } else if (level === 'manage') {
      next.delete(`${module}:manage`)
    } else if (on) {
      next.add(`${module}:view`)
    } else {
      next.delete(`${module}:view`)
      next.delete(`${module}:manage`)
    }
    onChange([...next])
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-[1fr_64px_64px] border-b bg-muted px-3 py-2 text-caption font-semibold text-muted-foreground">
        <span>Area</span>
        <span className="text-center">View</span>
        <span className="text-center">Manage</span>
      </div>
      {modules.map((m) => (
        <div key={m.key} className="grid grid-cols-[1fr_64px_64px] items-center border-b px-3 py-2.5 last:border-0">
          <div className="pr-3">
            <p className="text-sm font-semibold">{m.label}</p>
            <p className="text-caption text-muted-foreground">{m.description}</p>
          </div>
          <span className="flex justify-center">
            <Checkbox checked={has(`${m.key}:view`)} onCheckedChange={(v) => toggle(m.key, 'view', v === true)} aria-label={`${m.label} — view`} />
          </span>
          <span className="flex justify-center">
            {(m.levels ?? ['view', 'manage']).includes('manage') ? (
              <Checkbox checked={has(`${m.key}:manage`)} onCheckedChange={(v) => toggle(m.key, 'manage', v === true)} aria-label={`${m.label} — manage`} />
            ) : (
              <span className="text-subtle" aria-label="Not applicable">
                —
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Create (admin = null) or edit a sub admin. */
function AccountDialog({ open, admin, modules, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(admin ? { ...EMPTY, ...admin, password: '' } : EMPTY)
    setErrors({})
  }, [open, admin])

  const set = (key, value) => {
    setErrors((e) => ({ ...e, [key]: undefined }))
    setForm((f) => ({ ...f, [key]: value }))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { fullName, email, password, permissions, isActive } = form
      if (admin) await adminService.updateAdminAccount(admin.id, { fullName, permissions, isActive })
      else await adminService.createAdminAccount({ fullName, email, password, permissions })
      toast.success(admin ? 'Sub admin updated' : 'Sub admin created')
      onSaved()
    } catch (err) {
      setErrors(err.details ?? {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={save} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">{admin ? `Edit ${admin.fullName}` : 'New sub admin'}</DialogTitle>
            <DialogDescription>Sub admins only see and can do what you grant below. Changes apply immediately.</DialogDescription>
          </DialogHeader>

          <Field label="Full name" error={errors.fullName}>
            <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} maxLength={100} aria-invalid={!!errors.fullName} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={!!admin} aria-invalid={!!errors.email} />
          </Field>
          {!admin && (
            <Field label="Initial password" hint="8+ characters with upper and lower case, a number and a symbol. Share it securely." error={errors.password}>
              <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} aria-invalid={!!errors.password} />
            </Field>
          )}

          <Field label="Permissions" error={errors.permissions}>
            <PermissionMatrix modules={modules} value={form.permissions} onChange={(v) => set('permissions', v)} />
          </Field>

          {admin && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
              <Checkbox checked={form.isActive} onCheckedChange={(v) => set('isActive', v === true)} />
              Account active <span className="font-normal text-muted-foreground">— inactive admins are signed out and cannot sign in</span>
            </label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              {admin ? 'Save changes' : 'Create sub admin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PasswordDialog({ admin, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPassword('')
    setError('')
  }, [admin])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminService.resetAdminAccountPassword(admin.id, password)
      toast.success(`Password reset for ${admin.fullName}`)
      onClose()
    } catch (err) {
      setError(err.details?.password ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!admin} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Reset password</DialogTitle>
            <DialogDescription>Set a new password for {admin?.fullName}. Their current sessions keep working until they expire.</DialogDescription>
          </DialogHeader>
          <Field label="New password" error={error}>
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => (setPassword(e.target.value), setError(''))} aria-invalid={!!error} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !password}>
              {saving && <Spinner />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminAccountsPage() {
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, object = edit
  const [resetting, setResetting] = useState(null)
  const { data: meta } = useAsync(() => adminService.getAdminAccountsMeta().then((r) => r.data), [])
  const { data: admins } = useAsync(() => adminService.listAdminAccounts().then((r) => r.data), [reloadKey])
  const modules = meta?.modules ?? []

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Admins & Permissions</h1>
          <p className="pt-[6.25px] text-title text-muted-foreground">Create sub admins and choose which areas of the portal each one can view or manage.</p>
        </div>
        <Button className="h-[50px] px-[21.25px] text-title font-bold" onClick={() => setEditing(null)} disabled={!meta}>
          <PlusIcon />
          New sub admin
        </Button>
      </div>

      <section className="mt-[18.75px] overflow-hidden rounded-[11.25px] border bg-card shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} pl-5`}>Admin</th>
                <th className={th}>Role</th>
                <th className={th}>Access</th>
                <th className={th}>Status</th>
                <th className={th}>Last sign-in</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(admins ?? []).map((a) => {
                const isSuper = a.role === 'super_admin'
                const areas = modules.filter((m) => a.permissions.includes(`${m.key}:view`))
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className={`${td} pl-5`}>
                      <p className="text-title font-semibold">{a.fullName}</p>
                      <p className="text-caption text-muted-foreground">{a.email}</p>
                    </td>
                    <td className={td}>
                      <StatusBadge tone={isSuper ? 'brand' : 'neutral'} className="h-[26px]">
                        {isSuper ? 'Super admin' : 'Sub admin'}
                      </StatusBadge>
                    </td>
                    <td className={`${td} max-w-[320px] text-caption`}>
                      {isSuper ? (
                        <span className="text-muted-foreground">Full access</span>
                      ) : areas.length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {areas.map((m) => (
                            <span key={m.key} className="rounded-md bg-muted px-2 py-0.5">
                              {m.label}
                              <span className="text-muted-foreground"> · {a.permissions.includes(`${m.key}:manage`) ? 'manage' : 'view'}</span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-subtle">No access</span>
                      )}
                    </td>
                    <td className={td}>
                      <StatusBadge tone={a.isActive ? 'success' : 'danger'} icon={false} className="h-[26px]">
                        {a.isActive ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </td>
                    <td className={`${td} text-caption text-muted-foreground whitespace-nowrap`}>{a.lastLoginAt ? formatDateTime24(a.lastLoginAt) : 'Never'}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {isSuper ? (
                        <span className="text-caption text-subtle">—</span>
                      ) : (
                        <span className="flex gap-2">
                          <Button variant="outline" className="h-[35px] rounded-lg px-[11.25px] text-title font-bold" onClick={() => setEditing(a)}>
                            Edit
                          </Button>
                          <Button variant="outline" className="h-[35px] rounded-lg px-[11.25px] text-title font-bold" onClick={() => setResetting(a)}>
                            <KeyRoundIcon />
                            Password
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!admins && <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}
        </div>
      </section>

      <AccountDialog
        open={editing !== undefined}
        admin={editing ?? null}
        modules={modules}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined)
          setReloadKey((k) => k + 1)
        }}
      />
      <PasswordDialog admin={resetting} onClose={() => setResetting(null)} />
    </>
  )
}
