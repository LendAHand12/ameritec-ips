import { useMemo, useState } from 'react'
import { KeyRoundIcon, PlusIcon, SearchIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import AdminSecurityTab from '@/components/admin/AdminSecurityTab'
import { AccountDialog, PasswordDialog, RoleDialog } from '@/components/admin/AdminAccountDialogs'
import FilterSelect from '@/components/admin/FilterSelect'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { useAsync } from '@/hooks/useAsync'
import { ADMINISTRATOR, levelFor } from '@/lib/adminRoles'
import { formatDateTime24, formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import * as adminService from '@/services/admin.service'

const TABS = ['Admin Users', 'Roles & Permissions', 'Security']

const ROLE_LABEL = { super_admin: 'Super admin', sub_admin: 'Sub admin' }
const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))
// An account that has never signed in is still waiting for its owner to pick it up
const STATUS = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invited', tone: 'neutral' },
  suspended: { label: 'Suspended', tone: 'danger' },
}
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))
const statusOf = (a) => (!a.isActive ? 'suspended' : a.lastLoginAt ? 'active' : 'invited')

const th = 'border-y border-divider bg-muted px-[15px] py-[12.5px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-[15px] py-[16.25px] text-caption whitespace-nowrap'

function Stat({ label, value }) {
  return (
    <article className="rounded-[15px] border bg-card p-5 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
      <p className="text-title font-semibold text-muted-foreground">{label}</p>
      <p className="pt-2.5 text-heading font-bold tabular-nums">{value ?? '—'}</p>
    </article>
  )
}

function AdminUsersTab({ admins, onEdit, onReset, onDelete }) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')

  // Stable "ADM-001" numbers, in the order the accounts were created
  const rows = useMemo(() => (admins ?? []).map((a, i) => ({ ...a, code: `ADM-${String(i + 1).padStart(3, '0')}`, state: statusOf(a) })), [admins])
  const count = (state) => (admins ? rows.filter((a) => a.state === state).length : undefined)
  const filtered = rows.filter((a) => {
    const q = search.trim().toLowerCase()
    return (!q || a.fullName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) && (!role || a.role === role) && (!status || a.state === status)
  })

  return (
    <>
      <div className="mt-[15px] grid gap-[10px] sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Admin Users" value={admins ? formatInt(rows.length) : undefined} />
        <Stat label="Active" value={admins ? formatInt(count('active')) : undefined} />
        <Stat label="Invited" value={admins ? formatInt(count('invited')) : undefined} />
        <Stat label="Suspended" value={admins ? formatInt(count('suspended')) : undefined} />
      </div>

      <div className="mt-[15px] grid gap-[10px] lg:grid-cols-[2fr_1fr_1fr]">
        <label className="flex h-[42.5px] items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30">
          <SearchIcon className="size-5 shrink-0 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search admin name or email"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
            aria-label="Search admin users"
          />
        </label>
        <FilterSelect label="Role" allLabel="All Roles" options={ROLE_OPTIONS} value={role} onChange={setRole} className="h-[42.5px] w-full rounded-[10px] bg-card text-title font-medium text-foreground" />
        <FilterSelect label="Status" allLabel="All Statuses" options={STATUS_OPTIONS} value={status} onChange={setStatus} className="h-[42.5px] w-full rounded-[10px] bg-card text-title font-medium text-foreground" />
      </div>

      <section className="mt-[10px] overflow-hidden rounded-[15px] border bg-card shadow-[0_1.25px_2.5px_rgb(0_0_0/0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                <th className={cn(th, 'pl-[25px]')}>Admin</th>
                <th className={th}>Email</th>
                <th className={th}>Role</th>
                <th className={th}>Status</th>
                <th className={th}>Last Active</th>
                <th className={th}>2FA</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const s = STATUS[a.state]
                const isSuper = a.role === 'super_admin'
                return (
                  <tr key={a.id} className="transition-colors hover:bg-muted/40">
                    <td className={cn(td, 'pl-[25px]')}>
                      <p className="font-semibold text-foreground">{a.fullName}</p>
                      <p className="pt-[3px] text-muted-foreground">{a.code}</p>
                    </td>
                    <td className={cn(td, 'text-muted-foreground')}>{a.email}</td>
                    <td className={cn(td, 'text-muted-foreground')}>{ROLE_LABEL[a.role] ?? a.role}</td>
                    <td className={td}>
                      <StatusBadge tone={s.tone} icon={false} className="h-[29px]">
                        {s.label}
                      </StatusBadge>
                    </td>
                    <td className={cn(td, 'text-muted-foreground')}>{a.lastLoginAt ? formatDateTime24(a.lastLoginAt) : 'Invitation pending'}</td>
                    {/* Admin sign-in has no two-factor step yet */}
                    <td className={cn(td, 'text-subtle')}>Not available</td>
                    <td className={td}>
                      {isSuper ? (
                        <span className="text-subtle" title="Super admin accounts are managed outside the portal">
                          —
                        </span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="outline" className="h-[35px] rounded-[10px] px-2.5 text-title font-bold" />}>Manage</DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(a)}>Edit access</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onReset(a)}>
                              <KeyRoundIcon />
                              Reset password
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => onDelete(a)}>
                              <Trash2Icon />
                              Delete admin
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!admins && <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}
          {admins && !filtered.length && <p className="py-10 text-center text-caption text-muted-foreground">No admin users match your filters.</p>}
        </div>
      </section>
    </>
  )
}

function RoleCard({ role, count, modules, onView, onEdit, onDelete }) {
  const perms = role.permissions
  return (
    <article className="flex flex-col rounded-[15px] border bg-card p-5 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
      <div className="flex items-center justify-between">
        <span className="flex size-[37.5px] items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
          <ShieldCheckIcon className="size-[25px]" />
        </span>
        <span className="rounded-full px-2.5 py-[6px] text-caption font-semibold">
          {count} Admin{count === 1 ? '' : 's'}
        </span>
      </div>
      <h2 className="pt-[15px] text-subheading font-semibold">{role.name}</h2>
      <p className="min-h-[70px] text-title text-muted-foreground">{role.description}</p>
      <div className="grid gap-[10px] pb-[15px] sm:grid-cols-2">
        {modules.map((m) => {
          const level = role.superAdmin ? 'manage' : levelFor(perms, m.key)
          if (!level) return null
          return (
            <div key={m.key} className="rounded-[10px] bg-muted p-[10px]">
              <p className="text-subheading font-bold">{m.label}</p>
              <p className="text-title text-muted-foreground">{level === 'manage' ? 'View & manage' : 'View only'}</p>
            </div>
          )
        })}
      </div>
      <div className="mt-auto flex gap-[10px]">
        <Button variant="outline" className="h-[50px] flex-1 rounded-[10px] px-[21.25px] text-title font-bold" onClick={onView}>
          View Permissions
        </Button>
        {onEdit && (
          <Button variant="outline" className="h-[50px] rounded-[10px] px-4 text-title font-bold" onClick={onEdit}>
            Edit
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="icon" className="size-[50px] rounded-[10px] text-destructive" onClick={onDelete} aria-label={`Delete ${role.name}`}>
            <Trash2Icon />
          </Button>
        )}
      </div>
    </article>
  )
}

function PermissionsDialog({ role, modules, onClose }) {
  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-subheading font-bold">{role?.name} — permissions</DialogTitle>
          <DialogDescription>{role?.description}</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border">
          {modules.map((m) => {
            const level = role?.superAdmin ? 'manage' : levelFor(role?.permissions ?? [], m.key)
            return (
              <div key={m.key} className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-0">
                <div>
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-caption text-muted-foreground">{m.description}</p>
                </div>
                <StatusBadge tone={level === 'manage' ? 'success' : level === 'view' ? 'neutral' : 'danger'} icon={false} className="h-[26px] shrink-0">
                  {level === 'manage' ? 'View & manage' : level === 'view' ? 'View only' : 'No access'}
                </StatusBadge>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Roles as cards: what each can do and how many admins have it. Roles can be created, edited and deleted. */
function RolesTab({ admins, roles, modules, onCreate, onEdit, onChanged }) {
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  if (!admins || !roles || !modules.length) return <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />
  const subs = admins.filter((a) => a.role !== 'super_admin')
  const custom = subs.filter((a) => !a.roleId)
  const customRole = {
    name: 'Custom access',
    description: 'Admins whose permissions were set individually, without a role.',
    permissions: [...new Set(custom.flatMap((a) => a.permissions))],
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await adminService.deleteAdminRole(deleting.id)
      toast.success(`Role "${deleting.name}" deleted`)
      setDeleting(null)
      onChanged()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mt-[15px] flex items-center justify-between gap-3">
        <p className="text-caption text-muted-foreground">Roles are named sets of permissions you can give to sub admins.</p>
        <Button className="h-[42.5px] px-[17.5px] text-title font-bold" onClick={onCreate}>
          <PlusIcon />
          Create Role
        </Button>
      </div>
      <div className="mt-[10px] grid gap-[10px] lg:grid-cols-2">
        <RoleCard role={ADMINISTRATOR} count={admins.length - subs.length} modules={modules} onView={() => setViewing(ADMINISTRATOR)} />
        {roles.map((r) => (
          <RoleCard key={r.id} role={r} count={r.adminCount} modules={modules} onView={() => setViewing(r)} onEdit={() => onEdit(r)} onDelete={() => setDeleting(r)} />
        ))}
        {custom.length > 0 && <RoleCard role={customRole} count={custom.length} modules={modules} onView={() => setViewing(customRole)} />}
      </div>
      <PermissionsDialog role={viewing} modules={modules} onClose={() => setViewing(null)} />
      <Dialog open={!!deleting} onOpenChange={(o) => !o && !busy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Delete role</DialogTitle>
            <DialogDescription>
              {deleting?.adminCount
                ? `${deleting.adminCount} admin(s) still have “${deleting.name}”. Give them another role first.`
                : `Delete “${deleting?.name}”? This can’t be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy || !!deleting?.adminCount}>
              {busy && <Spinner />}
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Super admin view: admins, roles and security. */
function SuperAdminSettings() {
  const [tab, setTab] = useState(TABS[0])
  const [deleting, setDeleting] = useState(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, object = edit
  const [resetting, setResetting] = useState(null)
  const [editingRole, setEditingRole] = useState(undefined) // undefined = closed, null = new, object = edit
  const { data: meta } = useAsync(() => adminService.getAdminAccountsMeta().then((r) => r.data), [])
  const { data: admins } = useAsync(() => adminService.listAdminAccounts().then((r) => r.data), [reloadKey])
  const { data: roles } = useAsync(() => adminService.listAdminRoles().then((r) => r.data), [reloadKey])
  const modules = meta?.modules ?? []
  const reload = () => setReloadKey((k) => k + 1)

  const confirmDelete = async () => {
    setDeletingBusy(true)
    try {
      await adminService.deleteAdminAccount(deleting.id)
      toast.success(`${deleting.fullName} was deleted`)
      setDeleting(null)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Settings</h1>
          <p className="pt-[6.25px] text-caption text-muted-foreground">Manage administrative access, permissions, security, and system preferences.</p>
        </div>
        <Button className="h-[50px] px-[21.25px] text-title font-bold shadow-brand" onClick={() => setEditing(null)} disabled={!meta}>
          <PlusIcon />
          Add Admin User
        </Button>
      </div>

      <div role="tablist" aria-label="Settings sections" className="mt-5 flex gap-[25px] overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'h-[56px] shrink-0 border-b-[2.5px] px-[5px] pt-2.5 pb-[15px] text-subheading font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Admin Users' && <AdminUsersTab admins={admins} onEdit={setEditing} onReset={setResetting} onDelete={setDeleting} />}
      {tab === 'Roles & Permissions' && <RolesTab admins={admins} roles={roles} modules={modules} onCreate={() => setEditingRole(null)} onEdit={setEditingRole} onChanged={reload} />}
      {tab === 'Security' && <AdminSecurityTab />}

      <AccountDialog
        open={editing !== undefined}
        admin={editing ?? null}
        modules={modules}
        roles={roles ?? []}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined)
          setReloadKey((k) => k + 1)
        }}
      />
      <PasswordDialog admin={resetting} onClose={() => setResetting(null)} />
      <Dialog open={!!deleting} onOpenChange={(o) => !o && !deletingBusy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Delete admin</DialogTitle>
            <DialogDescription>
              Delete {deleting?.fullName} ({deleting?.email})? They are signed out and can’t sign in again. What they did stays in the audit log. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletingBusy}>
              {deletingBusy && <Spinner />}
              Delete admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RoleDialog
        open={editingRole !== undefined}
        role={editingRole ?? null}
        modules={modules}
        onClose={() => setEditingRole(undefined)}
        onSaved={() => {
          setEditingRole(undefined)
          reload()
        }}
      />
    </>
  )
}

/** Every admin: their own two-factor sign-in. Managing admins and roles is for super admins only. */
export default function AdminSettingsPage() {
  const { admin } = useAdminAuth()
  if (admin?.role === 'super_admin') return <SuperAdminSettings />
  return (
    <>
      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Settings</h1>
        <p className="pt-[6.25px] text-caption text-muted-foreground">Manage the security of your own account.</p>
      </div>
      <div role="tablist" aria-label="Settings sections" className="mt-5 flex gap-[25px] overflow-x-auto border-b">
        <button type="button" role="tab" aria-selected className="h-[56px] shrink-0 border-b-[2.5px] border-primary px-[5px] pt-2.5 pb-[15px] text-subheading font-bold whitespace-nowrap text-foreground">
          Security
        </button>
      </div>
      <AdminSecurityTab />
    </>
  )
}
