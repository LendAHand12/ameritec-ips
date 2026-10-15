import { Outlet } from 'react-router-dom'
import ReferralTracker from '@/components/ReferralTracker'

export default function RootLayout() {
  return (
    <>
      <ReferralTracker />
      <Outlet />
    </>
  )
}
