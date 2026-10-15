import { Navigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import FullPageSpinner from '@/components/FullPageSpinner'

export default function AdminGuestRoute() {
  const { admin, loading } = useAdminAuth()

  if (loading) return <FullPageSpinner />
  if (admin) return <Navigate to="/admin" replace />
  return <Outlet />
}
