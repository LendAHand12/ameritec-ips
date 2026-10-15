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
import { formatUsdt } from '@/lib/format'
import { LEGAL_LINKS } from '@/lib/legal'
import { cn } from '@/lib/utils'
import { getTradeConfig } from '@/services/trade.service'

const USER_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/trade', label: 'Trade' },
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

function NotificationsButton({ unread = 0 }) {
  return (
    <Popover>
      <PopoverTrigger
        className="relative flex size-10 items-center justify-center rounded-lg bg-card sm:size-[50px] transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <BellIcon className="size-[25px]" />
        {unread > 0 && <span className="absolute top-[8.75px] left-[31.25px] size-[8.75px] rounded-full bg-primary" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-title font-bold">Notifications</p>
        <p className="text-caption text-muted-foreground">Notifications are coming soon.</p>
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
