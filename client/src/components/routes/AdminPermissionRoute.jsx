import { Navigate, Outlet, useOutletContext } from 'react-router-dom'
import { useAdminAuth } from '@/hooks/useAdminAuth'

/** Admin landing page for whoever has no Overview access: the first area they can open. */
export const ADMIN_AREAS = [
  ['overview:view', '/admin'],
  ['users:view', '/admin/users'],
  ['orders:view', '/admin/transactions'],
  ['referrals:view', '/admin/referrals'],
  ['parameters:view', '/admin/parameters'],
  ['support:view', '/admin/support'],
  ['audit:view', '/admin/audit-logs'],
  ['admins:manage', '/admin/admins'],
]

/** Renders the nested routes only when the signed-in admin holds `permission`. */
export default function AdminPermissionRoute({ permission }) {
  const { can } = useAdminAuth()
  const context = useOutletContext() // keep passing the layout's stats / refreshStats down to the pages
  if (can(permission)) return <Outlet context={context} />
  const fallback = ADMIN_AREAS.find(([p]) => can(p))?.[1]
  return fallback ? <Navigate to={fallback} replace /> : <NoAccess />
}

function NoAccess() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-subheading font-bold">No access</h1>
      <p className="pt-2 text-title text-muted-foreground">Your account has no permissions yet. Ask a super admin to grant access.</p>
    </div>
  )
}
