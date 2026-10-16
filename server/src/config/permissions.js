export const ADMIN_ROLES = { SUPER: 'super_admin', SUB: 'sub_admin' }

/** Admin portal areas a sub admin can be given access to — each has a read-only and a full level. */
export const PERMISSION_MODULES = [
  { key: 'overview', label: 'Overview', description: 'Dashboard figures and charts' },
  { key: 'users', label: 'Users & KYC', description: 'Investor list, identity documents, approve / reject / lock' },
  { key: 'orders', label: 'Transactions', description: 'Share purchases, payment approval, certificates' },
  { key: 'referrals', label: 'Referral & Commission', description: 'Commission ledger and referrers (view); process withdrawals (manage)' },
  { key: 'parameters', label: 'Operational Parameters', description: 'Prices, allocation, commissions, payment methods' },
  { key: 'support', label: 'Support', description: 'Tickets and the help article catalog' },
  { key: 'audit', label: 'Audit Logs', description: 'Admin activity history and exports' },
]

export const PERMISSION_LEVELS = ['view', 'manage']
// A module may offer only some levels (e.g. a read-only page is just "view")
export const PERMISSIONS = PERMISSION_MODULES.flatMap((m) => (m.levels ?? PERMISSION_LEVELS).map((l) => `${m.key}:${l}`))
/** Only super admins can create and manage admin accounts; it can't be granted. */
export const ADMIN_MANAGEMENT = 'admins:manage'

/** "manage" includes "view" of the same module. */
export function grants(permissions, needed) {
  if (permissions.includes(needed)) return true
  const [module, level] = needed.split(':')
  return level === 'view' && permissions.includes(`${module}:manage`)
}

/** Normalises a requested list: only known permissions, and "manage" always carries "view". */
export function normalizePermissions(list) {
  const set = new Set(list.filter((p) => PERMISSIONS.includes(p)))
  for (const p of [...set]) if (p.endsWith(':manage')) set.add(p.replace(':manage', ':view'))
  return PERMISSIONS.filter((p) => set.has(p))
}
