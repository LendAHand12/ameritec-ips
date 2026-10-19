import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import EmailInput from '@/components/auth/EmailInput'
import FormField from '@/components/auth/FormField'
import PasswordInput from '@/components/auth/PasswordInput'
import PasswordRequirements from '@/components/auth/PasswordRequirements'
import PhoneInput from '@/components/auth/PhoneInput'
import { applyFieldErrors } from '@/lib/api'
import { LEGAL_LINKS } from '@/lib/legal'
import { accountInfoSchema } from '@/lib/schemas'
import { checkAccountInfo } from '@/services/auth.service'
import { ACCOUNT_FIELDS } from './constants'
import StepActions from './StepActions'

export default function StepAccountInfo({ defaultValues, serverErrors, onNext }) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(accountInfoSchema), defaultValues })
  const password = watch('password')

  // Errors returned by the final submit (e.g. email taken in the meantime)
  useEffect(() => {
    if (serverErrors) applyFieldErrors({ details: serverErrors }, setError, ACCOUNT_FIELDS)
  }, [serverErrors, setError])

  const onSubmit = async (values) => {
    try {
      const { referrer } = await checkAccountInfo(values)
      onNext(values, referrer)
    } catch (err) {
      if (!applyFieldErrors(err, setError, ACCOUNT_FIELDS)) toast.error(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-x-[17.5px] gap-y-5 md:grid-cols-2">
        <FormField id="fullName" label="Full Name" required error={errors.fullName}>
          <Input
            id="fullName"
            size="lg"
            autoComplete="name"
            placeholder="Enter your full legal name"
            aria-invalid={!!errors.fullName}
            {...register('fullName')}
          />
        </FormField>

        <FormField id="email" label="Email Address" required error={errors.email}>
          <EmailInput id="email" size="lg" placeholder="name@example.com" aria-invalid={!!errors.email} {...register('email')} />
        </FormField>

        <FormField id="phoneNumber" label="Phone Number" required error={errors.phoneNumber}>
          <Controller
            name="phoneCountry"
            control={control}
            render={({ field }) => (
              <PhoneInput
                id="phoneNumber"
                size="lg"
                placeholder="555 000 0000"
                country={field.value}
                onCountryChange={field.onChange}
                invalid={!!errors.phoneNumber}
                {...register('phoneNumber')}
              />
            )}
          />
        </FormField>

        <FormField id="referralCode" label="Referral Code" error={errors.referralCode}>
          <Input
            id="referralCode"
            size="lg"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Enter referral code"
            className="uppercase placeholder:normal-case"
            aria-invalid={!!errors.referralCode}
            {...register('referralCode')}
          />
        </FormField>

        <FormField id="password" label="Password" required error={errors.password}>
          <PasswordInput
            id="password"
            size="lg"
            autoComplete="new-password"
            placeholder="Create a secure password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>

        <FormField id="confirmPassword" label="Confirm Password" required error={errors.confirmPassword}>
          <PasswordInput
            id="confirmPassword"
            size="lg"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
        </FormField>
      </div>

      <div className="pt-5">
        <PasswordRequirements value={password} />
      </div>

      <Field data-invalid={!!errors.acceptTerms} className="pt-5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <Controller
            name="acceptTerms"
            control={control}
            render={({ field }) => (
              <Checkbox
                className="mt-px size-[21.25px] rounded-[5px] [&_svg]:size-4!"
                checked={!!field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-invalid={!!errors.acceptTerms}
              />
            )}
          />
          <span className="pt-0.5 text-caption text-muted-foreground">
            I agree to the{' '}
            <a href={LEGAL_LINKS.terms} className="text-primary hover:underline">Terms of Service</a> and{' '}
            <a href={LEGAL_LINKS.privacy} className="text-primary hover:underline">Privacy Policy</a>.
          </span>
        </label>
        <FieldError errors={[errors.acceptTerms]} />
      </Field>

      <p className="pt-3 text-caption text-muted-foreground">
        Please also read the offering documents:{' '}
        <a href="/legal/regulation-d" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Regulation D (U.S. investors)</a> and{' '}
        <a href="/legal/regulation-s" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Regulation S (international investors)</a>.
      </p>

      <StepActions nextType="submit" loading={isSubmitting} />
    </form>
  )
}
