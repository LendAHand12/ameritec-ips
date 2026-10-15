import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ADMIN_UNAUTHORIZED_EVENT } from '@/lib/api'
import * as adminService from '@/services/admin.service'
import { AdminAuthContext } from './admin-auth-context'

/** Admin session, independent from the customer AuthProvider. Mounted only under /admin routes. */
export default function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { admin } = await adminService.getAdminMe()
      setAdmin(admin)
    } catch {
      setAdmin(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await adminService.adminLogout().catch(() => {})
    setAdmin(null)
  }, [])

  useEffect(() => {
    refresh()
    const onUnauthorized = () => setAdmin(null)
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized)
  }, [refresh])

  const value = useMemo(() => ({ admin, setAdmin, loading, refresh, logout }), [admin, loading, refresh, logout])

  return <AdminAuthContext.Provider value={value}>{children ?? <Outlet />}</AdminAuthContext.Provider>
}
