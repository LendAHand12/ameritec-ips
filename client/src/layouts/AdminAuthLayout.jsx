import { Outlet } from 'react-router-dom'
import { LockKeyholeIcon } from 'lucide-react'
import Logo from '@/components/brand/Logo'

export default function AdminAuthLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-muted">
      <header>
        <div className="mx-auto flex h-[84px] w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-[35px]">
          <Logo to="/admin/login" />
          <span className="hidden items-center gap-[7.5px] text-caption font-semibold text-muted-foreground sm:flex">
            <LockKeyholeIcon className="size-4" />
            Admin Portal
          </span>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-4">
        <Outlet />
        <footer className="mt-auto w-full max-w-[1350px] py-5 text-center text-caption text-subtle sm:px-[30px] sm:text-left">
          © {new Date().getFullYear()} Ameritec IPS · Authorized personnel only
        </footer>
      </main>
    </div>
  )
}
