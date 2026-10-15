import { Link } from 'react-router-dom'
import { KeyRoundIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import AuthCard from '@/components/auth/AuthCard'

// TODO: password reset flow (request link by email → set new password)
export default function ForgotPasswordPage() {
  return (
    <div className="flex w-full max-w-[550px] flex-1 flex-col justify-center py-[37.5px]">
      <AuthCard
        icon={KeyRoundIcon}
        title="Forgot password"
        description="Password reset is coming soon. Please contact support if you can't access your account."
      >
        <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'xl', className: 'w-full bg-card' })}>
          Back to Sign In
        </Link>
      </AuthCard>
    </div>
  )
}
