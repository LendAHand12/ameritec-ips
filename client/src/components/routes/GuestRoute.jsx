import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import FullPageSpinner from '@/components/FullPageSpinner'

/** Pages only for signed-out visitors (login, register, ...). */
export default function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
