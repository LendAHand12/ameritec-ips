import { Navigate, createBrowserRouter } from 'react-router-dom'
import RootLayout from '@/layouts/RootLayout'
import AuthLayout from '@/layouts/AuthLayout'
import UserLayout from '@/layouts/UserLayout'
import GuestRoute from '@/components/routes/GuestRoute'
import ProtectedRoute from '@/components/routes/ProtectedRoute'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/register/RegisterPage'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage'
import ApplicationStatusPage from '@/pages/auth/ApplicationStatusPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import DashboardPage from '@/pages/user/DashboardPage'
// import TradePage from '@/pages/trade/TradePage' // hidden for now
import OrderPaymentPage from '@/pages/trade/OrderPaymentPage'
import OrdersPage from '@/pages/trade/OrdersPage'
import ReferralsPage from '@/pages/user/ReferralsPage'
import GuidePage from '@/pages/user/GuidePage'
import SupportPage from '@/pages/user/SupportPage'
import AccountPage from '@/pages/user/AccountPage'
import NotFoundPage from '@/pages/NotFoundPage'
import LegalPage from '@/pages/LegalPage'
import AdminAuthProvider from '@/context/AdminAuthProvider'
import AdminAuthLayout from '@/layouts/AdminAuthLayout'
import AdminLayout from '@/layouts/AdminLayout'
import AdminGuestRoute from '@/components/routes/AdminGuestRoute'
import AdminPermissionRoute from '@/components/routes/AdminPermissionRoute'
import KycCallbackPage from '@/pages/user/KycCallbackPage'
import AdminReferralsPage from '@/pages/admin/AdminReferralsPage'
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage'
import AdminProtectedRoute from '@/components/routes/AdminProtectedRoute'
import AdminLoginPage from '@/pages/admin/AdminLoginPage'
import AdminOverviewPage from '@/pages/admin/AdminOverviewPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminTransactionsPage from '@/pages/admin/AdminTransactionsPage'
import AdminParametersPage from '@/pages/admin/AdminParametersPage'
import AdminSupportPage from '@/pages/admin/AdminSupportPage'
import AdminNotificationsPage from '@/pages/admin/AdminNotificationsPage'
import AdminSupportTicketPage from '@/pages/admin/AdminSupportTicketPage'
import AdminAuditLogsPage from '@/pages/admin/AdminAuditLogsPage'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      // Offering documents are public (linked from registration)
      { path: 'legal/:doc', element: <LegalPage /> },
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
              { path: 'verify-email', element: <VerifyEmailPage /> },
              { path: 'application-status', element: <ApplicationStatusPage /> },
              { path: 'account-pending', element: <Navigate to="/application-status" replace /> },
              { path: 'forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <UserLayout />,
            children: [
              { path: 'dashboard', element: <DashboardPage /> },
              // Trade page hidden for now
              // { path: 'trade', element: <TradePage /> },
              { path: 'trade/orders', element: <OrdersPage /> },
              { path: 'trade/orders/:id', element: <OrderPaymentPage /> },
              { path: 'referrals', element: <ReferralsPage /> },
              { path: 'guide', element: <GuidePage /> },
              { path: 'support', element: <SupportPage /> },
              { path: 'account', element: <AccountPage /> },
              // FaceTec sends the browser back here after the face scan
              { path: 'user/kyc-callback', element: <KycCallbackPage /> },
            ],
          },
        ],
      },
      // Admin portal — separate login and session from customers
      {
        path: 'admin',
        element: <AdminAuthProvider />,
        children: [
          {
            element: <AdminGuestRoute />,
            children: [{ element: <AdminAuthLayout />, children: [{ path: 'login', element: <AdminLoginPage /> }] }],
          },
          {
            element: <AdminProtectedRoute />,
            children: [
              {
                element: <AdminLayout />,
                children: [
                  {
                    element: <AdminPermissionRoute permission="overview:view" />,
                    children: [{ index: true, element: <AdminOverviewPage />, handle: { title: 'Overview' } }],
                  },
                  {
                    element: <AdminPermissionRoute permission="users:view" />,
                    children: [{ path: 'users', element: <AdminUsersPage />, handle: { title: 'Users & KYC' } }],
                  },
                  {
                    element: <AdminPermissionRoute permission="orders:view" />,
                    children: [{ path: 'transactions', element: <AdminTransactionsPage />, handle: { title: 'Transactions' } }],
                  },
                  {
                    element: <AdminPermissionRoute permission="referrals:view" />,
                    children: [{ path: 'referrals', element: <AdminReferralsPage />, handle: { title: 'Referral & Commission' } }],
                  },
                  {
                    element: <AdminPermissionRoute permission="parameters:view" />,
                    children: [{ path: 'parameters', element: <AdminParametersPage />, handle: { title: 'Operational Parameters' } }],
                  },
                  {
                    element: <AdminPermissionRoute permission="support:view" />,
                    children: [
                      { path: 'support', element: <AdminSupportPage />, handle: { title: 'Support' } },
                      { path: 'support/tickets/:id', element: <AdminSupportTicketPage />, handle: { title: 'Support' } },
                    ],
                  },
                  {
                    element: <AdminPermissionRoute permission="notifications:view" />,
                    children: [{ path: 'notifications', element: <AdminNotificationsPage />, handle: { title: 'Notifications' } }],
                  },
                  {
                    element: <AdminPermissionRoute permission="audit:view" />,
                    children: [{ path: 'audit-logs', element: <AdminAuditLogsPage />, handle: { title: 'Audit Logs' } }],
                  },
                  {
                    element: <AdminPermissionRoute permission="admins:manage" />,
                    children: [
                      { path: 'settings', element: <AdminSettingsPage />, handle: { title: 'Settings' } },
                      { path: 'admins', element: <Navigate to="/admin/settings" replace /> },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default router
