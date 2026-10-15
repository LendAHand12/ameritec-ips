import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import AuthProvider from '@/context/AuthProvider'
import router from '@/router'

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  )
}
