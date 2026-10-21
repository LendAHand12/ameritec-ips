import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BellIcon, ChevronDownIcon, LogOutIcon, ShieldCheckIcon, WalletIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Logo from '@/components/brand/Logo'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { formatDateTime24, formatUsdt } from '@/lib/format'
import { LEGAL_LINKS } from '@/lib/legal'
import { cn } from '@/lib/utils'
import { listNotifications, markNotificationsRead } from '@/services/notification.service'
import { getTradeConfig } from '@/services/trade.service'

const USER_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  // Trade page hidden for now — uncomment this item and the route in router.jsx to bring it back
  // { to: '/trade', label: 'Trade' },
  { to: '/referrals', label: 'Referral & Commission' },
  { to: '/guide', label: 'Guide' },
  { to: '/support', label: 'Support' },
]

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

function MainNav({ className, itemClassName }) {
  return (
    <nav aria-label="Main navigation" className={className}>
      {USER_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'relative flex items-center px-[15px] text-title font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
              isActive && 'font-bold text-foreground after:absolute after:inset-x-[15px] after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary',
              itemClassName,
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function BalancePill({ amount }) {
  return (
    <div className="hidden items-center gap-[11.25px] rounded-lg border border-divider bg-muted px-[13.75px] py-[8.75px] md:flex">
      <WalletIcon className="size-[21.25px] text-primary" aria-hidden />
      <div className="space-y-[1.25px]">
        <p className="text-caption whitespace-nowrap text-muted-foreground">Commission balance</p>
        <p className="whitespace-nowrap">
          <span className="text-title font-bold tabular-nums">{amount == null ? '—' : formatUsdt(amount)}</span>{' '}
          <span className="text-caption font-bold text-muted-foreground">USDT</span>
        </p>
      </div>
    </div>
  )
}

function NotificationsButton() {
  const [state, setState] = useState({ items: [], unread: 0 })
  const [open, setOpen] = useState(false)

  const load = useCallback(() => listNotifications().then((r) => setState({ items: r.data, unread: r.unread })).catch(() => {}), [])
  // Check on load and once a minute, so a new announcement shows up without refreshing
  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  const markRead = async (payload) => {
    await markNotificationsRead(payload).catch(() => {})
    load()
  }
  const toggle = (next) => {
    setOpen(next)
    if (next) load()
  }
  const { items, unread } = state

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger
        className="relative flex size-10 items-center justify-center rounded-lg bg-card sm:size-[50px] transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <BellIcon className="size-[25px]" />
        {unread > 0 && <span className="absolute top-[8.75px] left-[31.25px] size-[8.75px] rounded-full bg-primary" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-title font-bold">Notifications</p>
          {unread > 0 && (
            <button type="button" onClick={() => markRead({ all: true })} className="text-caption font-semibold text-primary hover:underline">
              Mark all as read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-caption text-muted-foreground">You’re all caught up.</p>
        ) : (
          <ul className="max-h-[380px] divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => !n.read && markRead({ ids: [n.id] })}
                  className={cn('block w-full px-4 py-3 text-left transition-colors hover:bg-muted', !n.read && 'bg-primary-soft/40')}
                >
                  <span className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{n.title}</span>
                      <span className="block whitespace-pre-line text-caption text-muted-foreground">{n.message}</span>
                      <span className="block pt-1 text-caption text-subtle">{formatDateTime24(n.createdAt)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-[11.25px] rounded-lg py-[2.5px] pr-1 pl-[6.25px] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-muted text-title font-bold text-white sm:size-[45px]">
          {initials(user.fullName)}
        </span>
        <span className="hidden flex-col items-start gap-[2.5px] text-left sm:flex">
          {/* <span className="max-w-40 truncate text-title font-bold">{user.fullName}</span> */}
          {/* <span className="text-caption text-muted-foreground">Investor</span> */}
        </span>
        {/* <ChevronDownIcon className="size-5 text-muted-foreground" aria-hidden /> */}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[287.5px] rounded-xl p-2.5 shadow-[0_22.5px_31.25px_rgb(0_0_0/0.18)]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-[5px] px-[12.5px] pt-[12.5px] pb-[15px]">
            <span className="block truncate text-title font-bold text-foreground">{user.fullName}</span>
            <span className="block truncate text-caption font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-divider" />
        <DropdownMenuItem className="h-[47.5px] px-[12.5px] text-title" onClick={() => navigate('/account')}>
          <ShieldCheckIcon />
          Account &amp; Security
        </DropdownMenuItem>
        <DropdownMenuItem className="h-[47.5px] px-[12.5px] text-title" onClick={handleLogout}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function UserLayout() {
  const location = useLocation()
  // Refetch on navigation so the balance stays fresh after purchases / commissions
  const { data: summary } = useAsync(getTradeConfig, [location.pathname])

  return (
    <div className="flex min-h-svh flex-col bg-muted">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex h-[72px] w-full max-w-[1600px] items-center gap-3 px-4 lg:h-[90px] lg:gap-[47.5px] lg:px-10">
          <Logo to="/dashboard" className="min-w-0 shrink max-sm:gap-2! max-sm:[&_img]:h-[18px] max-sm:[&_img]:w-auto max-sm:[&_span]:gap-2!" />
          <MainNav className="hidden h-full gap-[2.5px] lg:flex" />
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-[12.5px]">
            <BalancePill amount={summary?.balance} />
            <NotificationsButton />
            <UserMenu />
          </div>
        </div>
        <MainNav className="flex h-12 overflow-x-auto border-t border-divider lg:hidden" itemClassName="text-sm" />
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 pt-6 pb-[30px] lg:px-10 lg:pt-10">
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="flex flex-col items-center gap-3 px-[2.5px] pt-[27.5px] text-caption sm:flex-row sm:justify-between">
          <p className="text-subtle">© {new Date().getFullYear()} Ameritec IPS. All rights reserved.</p>
          <nav className="flex gap-[25px] text-muted-foreground">
            <a href={LEGAL_LINKS.privacy} className="hover:text-foreground">Privacy Policy</a>
            <a href={LEGAL_LINKS.terms} className="hover:text-foreground">Terms of Service</a>
            <a href={LEGAL_LINKS.help} className="hover:text-foreground">Help Center</a>
          </nav>
        </footer>
      </div>
    </div>
  )
}
