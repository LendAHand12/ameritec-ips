import { Link, Outlet, useLocation } from 'react-router-dom'
import { ShieldCheckIcon } from 'lucide-react'
import Logo from '@/components/brand/Logo'
import { LEGAL_LINKS } from '@/lib/legal'
import { cn } from '@/lib/utils'

function SecureBadge() {
  return (
    <span className="hidden items-center gap-[7.5px] text-caption text-success sm:flex">
      <ShieldCheckIcon className="size-5" />
      Secure registration
    </span>
  )
}

export default function AuthLayout() {
  const { pathname } = useLocation()
  // Registration (and the application status it leads to) has a solid white header and a 975px footer
  const isRegister = ['/register', '/application-status'].some((p) => pathname.startsWith(p))

  return (
    <div className="flex min-h-svh flex-col bg-muted">
      <header className={cn(isRegister && 'border-b bg-card')}>
        <div className="mx-auto flex h-[84px] w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-[35px]">
          <Logo />
          {isRegister && (
            <div className="flex items-center gap-[22.5px]">
              <SecureBadge />
              <Link to="/login" className="text-caption font-semibold text-primary hover:underline">
                Sign In
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className={cn('flex flex-1 flex-col items-center px-4', isRegister && 'pt-[35px] pb-[30px]')}>
        <Outlet />

        <footer
          className={cn(
            'mt-auto flex w-full flex-col items-center gap-3 text-caption sm:flex-row sm:justify-between',
            isRegister ? 'max-w-[975px] px-[3.75px] pt-[21.25px]' : 'max-w-[1350px] py-5 sm:px-[30px]',
          )}
        >
          <p className="text-subtle">© {new Date().getFullYear()} Ameritec IPS</p>
          <nav className="flex gap-[17.5px] text-muted-foreground">
            <a href={LEGAL_LINKS.privacy} className="hover:text-foreground">Privacy Policy</a>
            <a href={LEGAL_LINKS.terms} className="hover:text-foreground">Terms of Service</a>
            <a href={LEGAL_LINKS.help} className="hover:text-foreground">Help Center</a>
          </nav>
        </footer>
      </main>
    </div>
  )
}
