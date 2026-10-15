import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ArrowRightIcon, LockKeyholeIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import AuthCard from '@/components/auth/AuthCard'
import EmailInput from '@/components/auth/EmailInput'
import FormField from '@/components/auth/FormField'
import PasswordInput from '@/components/auth/PasswordInput'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { emailSchema } from '@/lib/schemas'
import { adminLogin } from '@/services/admin.service'

const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAdmin } = useAdminAuth()
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(adminLoginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = async (values) => {
    setError('')
    try {
      const { admin } = await adminLogin(values)
      setAdmin(admin)
      navigate(location.state?.from?.pathname ?? '/admin', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex w-full max-w-[550px] flex-1 flex-col justify-center py-[37.5px]">
      <AuthCard icon={LockKeyholeIcon} title="Admin Portal" description="Sign in with your administrator account.">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {error && (
            <Alert variant="destructive" className="mb-[17.5px]">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-[17.5px]">
            <FormField id="email" label="Email" labelSize="caption" required error={errors.email}>
              <EmailInput
                id="email"
                size="lg"
                className="h-[57.5px]"
                autoComplete="username"
                placeholder="admin@example.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
            </FormField>
            <FormField id="password" label="Password" labelSize="caption" required error={errors.password}>
              <PasswordInput
                id="password"
                size="lg"
                className="data-[size=lg]:h-[57.5px]"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
            </FormField>
          </div>
          <Button type="submit" size="xl" className="mt-[22.5px] w-full" disabled={isSubmitting}>
            Sign In
            {isSubmitting ? <Spinner className="size-5" /> : <ArrowRightIcon />}
          </Button>
        </form>
      </AuthCard>
    </div>
  )
}
