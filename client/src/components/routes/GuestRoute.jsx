import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import FullPageSpinner from '@/components/FullPageSpinner'

/** Pages only for signed-out visitors (login, register, ...). */
export default function GuestRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (user) {
    // Right after signing in, go back to the page that sent the visitor to /login (query string included)
    const from = location.state?.from
    return <Navigate to={from ? `${from.pathname}${from.search ?? ''}` : '/dashboard'} replace />
  }
  return <Outlet />
}
