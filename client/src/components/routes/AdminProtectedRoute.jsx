import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import FullPageSpinner from '@/components/FullPageSpinner'

export default function AdminProtectedRoute() {
  const { admin, loading } = useAdminAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location }} />
  return <Outlet />
}
