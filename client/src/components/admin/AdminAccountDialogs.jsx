import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import FilterSelect from '@/components/admin/FilterSelect'
import { Spinner } from '@/components/ui/spinner'
import * as adminService from '@/services/admin.service'

const EMPTY = { fullName: '', email: '', password: '', permissions: [], roleId: '', isActive: true }

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
export function PermissionMatrix({ modules, value, onChange }) {
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
export function AccountDialog({ open, admin, modules, roles = [], onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(admin ? { ...EMPTY, ...admin, roleId: admin.roleId ?? '', password: '' } : EMPTY)
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
      const roleId = form.roleId || null
      if (admin) await adminService.updateAdminAccount(admin.id, { fullName, permissions, roleId, isActive })
      else await adminService.createAdminAccount({ fullName, email, password, permissions, roleId })
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

          <Field label="Role" hint="Picking a role fills in its permissions. Changing them by hand makes this admin’s access custom." error={errors.roleId}>
            <FilterSelect
              label="Role"
              allLabel="Custom access"
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              value={form.roleId}
              onChange={(id) => setForm((f) => ({ ...f, roleId: id, permissions: id ? (roles.find((r) => r.id === id)?.permissions ?? f.permissions) : f.permissions }))}
              className="h-10 w-full rounded-lg bg-card text-sm text-foreground"
            />
          </Field>

          <Field label="Permissions" error={errors.permissions}>
            <PermissionMatrix modules={modules} value={form.permissions} onChange={(v) => setForm((f) => ({ ...f, roleId: '', permissions: v }))} />
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

export function PasswordDialog({ admin, onClose }) {
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

/** Create (role = null) or edit a role: a name and the permissions it carries. */
export function RoleDialog({ open, role, modules, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', permissions: [] })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(role ? { name: role.name, description: role.description ?? '', permissions: role.permissions } : { name: '', description: '', permissions: [] })
    setErrors({})
  }, [open, role])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (role) await adminService.updateAdminRole(role.id, form)
      else await adminService.createAdminRole(form)
      toast.success(role ? 'Role updated' : 'Role created')
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
            <DialogTitle className="text-subheading font-bold">{role ? `Edit role — ${role.name}` : 'New role'}</DialogTitle>
            <DialogDescription>
              {role?.adminCount ? `Changes apply immediately to the ${role.adminCount} admin(s) who have this role.` : 'Give this role to sub admins when you create or edit them.'}
            </DialogDescription>
          </DialogHeader>
          <Field label="Role name" error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }))
                setErrors((x) => ({ ...x, name: undefined }))
              }}
              maxLength={50}
              aria-invalid={!!errors.name}
              placeholder="e.g. Finance"
            />
          </Field>
          <Field label="Description" error={errors.description}>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={200} placeholder="What this role is for" />
          </Field>
          <Field label="Permissions" error={errors.permissions}>
            <PermissionMatrix modules={modules} value={form.permissions} onChange={(v) => setForm((f) => ({ ...f, permissions: v }))} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              {role ? 'Save role' : 'Create role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
