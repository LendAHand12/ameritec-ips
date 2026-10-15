import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom'
import {
  ArrowRightIcon,
  ArrowRightLeftIcon,
  BellIcon,
  BookOpenIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  LifeBuoyIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Logo from '@/components/brand/Logo'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getOrderStats, getSupportStats, getUserStats } from '@/services/admin.service'

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutGridIcon, end: true },
  { to: '/admin/users', label: 'Users & KYC', icon: UsersIcon, badge: 'pending' },
  { to: '/admin/transactions', label: 'Transactions', icon: ArrowRightLeftIcon, badge: 'ordersPending' },
  { to: '/admin/shares', label: 'Shares', icon: TrendingUpIcon },
  { to: '/admin/referrals', label: 'Referral & Commission', icon: UsersIcon },
  { to: '/admin/parameters', label: 'Operational Parameters', icon: SlidersHorizontalIcon },
  { to: '/admin/support', label: 'Support', icon: LifeBuoyIcon, badge: 'supportPending' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: BookOpenIcon },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
]

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

function Sidebar({ stats, onSignOut, onNavigate }) {
  const { admin } = useAdminAuth()
  return (
    <div className="flex h-full flex-col bg-black px-[15px] pb-[16.25px]">
      <div className="flex min-h-[95px] items-center border-b border-white/10 px-2.5">
        <Logo to="/admin" variant="light" />
      </div>

      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto pt-[21.25px]">
        <p className="px-[13.75px] pb-2.5 text-caption font-bold text-muted-foreground">OPERATIONS</p>
        {ADMIN_NAV.map(({ to, label, icon, end, badge }) => {
          const Icon = icon
          const count = badge ? stats?.[badge] : undefined
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[51.25px] items-center gap-2.5 rounded-[8.75px] px-[13.75px] text-caption text-steel transition-colors hover:bg-white/5 hover:text-white',
                  isActive && 'bg-primary/20 text-white shadow-[inset_2.5px_0_0_0_var(--primary)] hover:bg-primary/20',
                )
              }
            >
              <Icon className="size-[25px] shrink-0" />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span className="min-w-[23.75px] rounded-full bg-white/10 px-1.5 py-0.5 text-center text-caption font-bold text-[#e6e6e6]">
                  {formatInt(count)}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="px-[3.75px] pt-2.5 pb-[13.75px]">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/4 p-[12.5px]">
          <ShieldCheckIcon className="size-[25px] shrink-0 text-steel" />
          <div className="space-y-[3.75px] text-caption">
            <p className="font-bold text-[#e8e8e8]">Administrator access</p>
            <p className="text-muted-foreground">Actions are permission-aware</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t border-white/10 px-[6.25px] pt-[12.5px]">
        <span className="flex size-[45px] shrink-0 items-center justify-center rounded-full bg-primary text-title font-bold text-white">
          {initials(admin.fullName)}
        </span>
        <div className="min-w-0 flex-1 space-y-[3.75px] text-caption">
          <p className="truncate font-bold text-white">{admin.fullName}</p>
          <p className="text-subtle">Administrator</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="flex size-[35px] items-center justify-center rounded-md text-steel transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowRightIcon className="size-[25px]" />
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const matches = useMatches()
  const title = [...matches].reverse().find((m) => m.handle?.title)?.handle.title ?? 'Admin'
  const [stats, setStats] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const refreshStats = useCallback(
    () =>
      Promise.all([getUserStats(), getOrderStats(), getSupportStats()])
        .then(([users, orders, support]) => setStats({ ...users.data, ordersPending: orders.data.pendingReview, supportPending: support.needsAttention }))
        .catch(() => {}),
    [],
  )
  // Refresh the sidebar counters on every navigation
  useEffect(() => {
    refreshStats()
  }, [refreshStats, location.pathname])
  useEffect(() => setMenuOpen(false), [location.pathname])

  const handleSignOut = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-svh bg-muted lg:pl-[297.5px]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[297.5px] lg:block">
        <Sidebar stats={stats} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <aside className="relative h-full w-[297.5px] max-w-[85vw]">
            <Sidebar stats={stats} onSignOut={handleSignOut} onNavigate={() => setMenuOpen(false)} />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="absolute top-3 right-3 rounded-md p-1 text-white/70 hover:text-white"
            >
              <XIcon className="size-5" />
            </button>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b bg-card px-4 sm:px-[31.25px]">
        <button type="button" aria-label="Open menu" className="-ml-1 rounded-md p-1.5 hover:bg-muted lg:hidden" onClick={() => setMenuOpen(true)}>
          <MenuIcon className="size-6" />
        </button>
        <div className="min-w-0 space-y-[3.75px]">
          <p className="text-caption text-subtle">
            Admin Portal <span className="mx-1">/</span> {title}
          </p>
          <p className="truncate text-title font-bold">{title}</p>
        </div>

        <div className="ml-auto flex items-center gap-[11.25px]">
          <button
            type="button"
            aria-label="Notifications"
            className="hidden size-[50px] items-center justify-center rounded-lg bg-card hover:bg-muted sm:flex"
          >
            <BellIcon className="size-[25px]" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg p-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30">
              <span className="flex size-[45px] items-center justify-center rounded-full bg-brand-muted text-title font-bold text-white">
                {initials(admin.fullName)}
              </span>
              <span className="hidden flex-col items-start gap-[2.5px] text-caption sm:flex">
                <span className="font-bold">{admin.fullName}</span>
                <span className="text-muted-foreground">Administrator</span>
              </span>
              <ChevronDownIcon className="size-[18.75px] text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <span className="block truncate font-bold text-foreground">{admin.fullName}</span>
                  <span className="block truncate text-xs font-normal">{admin.email}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOutIcon />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-80px)] max-w-[1800px] flex-col px-4 pt-[28.75px] pb-5 sm:px-[31.25px]">
        <main className="flex-1">
          <Outlet context={{ stats, refreshStats }} />
        </main>
        <footer className="flex flex-col gap-2 pt-[27.5px] text-caption text-subtle sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Ameritec IPS Admin Portal</p>
          <p>Role: Administrator · Operational access</p>
        </footer>
      </div>
    </div>
  )
}
