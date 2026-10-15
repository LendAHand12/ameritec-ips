import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleHelpIcon, ShieldCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import FormField from '@/components/auth/FormField'
import { Panel } from '@/components/dashboard/Panel'
import StepActions from '@/pages/auth/register/StepActions'
import { applyFieldErrors } from '@/lib/api'
import { formatInt } from '@/lib/format'
import { supportRequestSchema } from '@/lib/schemas'
import { DESCRIPTION_MAX, MAX_ATTACHMENTS, SUPPORT_CATEGORIES } from '@/lib/support'
import { createTicket } from '@/services/support.service'
import AttachmentPicker from './AttachmentPicker'

const FIELDS = ['category', 'errorCode', 'relatedTransaction', 'subject', 'description']

/** Tab 2: open a support ticket. `prefill` comes from a help article ({ category, errorCode }). */
export default function SubmitRequest({ prefill, onBack, onCreated }) {
  const [files, setFiles] = useState([])
  const {
    control,
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: { category: '', errorCode: '', relatedTransaction: '', subject: '', description: '', ...prefill },
  })
  const descriptionLength = watch('description')?.length ?? 0

  const onSubmit = async (values) => {
    try {
      const { ticket } = await createTicket(values, files)
      toast.success(`Request ${ticket.ticketCode} submitted`)
      onCreated(ticket)
    } catch (err) {
      if (!applyFieldErrors(err, setError, FIELDS)) toast.error(err.details?.attachments ?? err.message)
    }
  }

  return (
    <Panel className="mx-auto w-full max-w-[1075px] p-5 sm:p-[30px]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex items-center gap-[13.75px] border-b border-divider pb-[22.5px]">
          <span className="flex size-[37.5px] shrink-0 items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
            <CircleHelpIcon className="size-[25px]" />
          </span>
          <div>
            <h2 className="text-subheading">Submit a Support Request</h2>
            <p className="pt-[6.25px] text-caption text-muted-foreground">Provide the details below and the support team will review your request.</p>
          </div>
        </div>

        <div className="grid gap-x-[17.5px] gap-y-5 pt-[22.5px] md:grid-cols-2">
          <FormField id="category" label="Issue Type" labelSize="caption" required error={errors.category}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select items={SUPPORT_CATEGORIES} value={field.value || null} onValueChange={(v) => field.onChange(v ?? '')}>
                  <SelectTrigger
                    id="category"
                    aria-invalid={!!errors.category}
                    className="w-full rounded-lg data-[size=default]:h-[54px] bg-card px-[17.75px] text-sm"
                  >
                    <SelectValue placeholder="Select an issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField id="errorCode" label="Error Code" labelSize="caption" error={errors.errorCode}>
            <Input id="errorCode" size="lg" placeholder="Example: KYC-001" aria-invalid={!!errors.errorCode} {...register('errorCode')} />
          </FormField>

          <FormField id="relatedTransaction" label="Related Transaction ID" labelSize="caption" error={errors.relatedTransaction}>
            <Input
              id="relatedTransaction"
              size="lg"
              placeholder="ORD-2026-000123"
              aria-invalid={!!errors.relatedTransaction}
              {...register('relatedTransaction')}
            />
          </FormField>

          <FormField id="subject" label="Subject" labelSize="caption" required error={errors.subject}>
            <Input
              id="subject"
              size="lg"
              placeholder="Briefly describe the issue"
              maxLength={150}
              aria-invalid={!!errors.subject}
              {...register('subject')}
            />
          </FormField>

          <FormField
            id="description"
            label="Description"
            labelSize="caption"
            required
            error={errors.description}
            className="md:col-span-2"
            description={
              <p className="text-right text-caption text-subtle tabular-nums" aria-live="polite">
                {formatInt(descriptionLength)}/{formatInt(DESCRIPTION_MAX)}
              </p>
            }
          >
            <Textarea
              id="description"
              rows={6}
              maxLength={DESCRIPTION_MAX}
              placeholder="Tell us what happened and what you have already tried."
              aria-invalid={!!errors.description}
              className="min-h-[131.25px] rounded-lg bg-card p-[13.75px] md:text-sm"
              {...register('description')}
            />
          </FormField>
        </div>

        <div className="mt-[22.5px] border-t border-divider pt-[22.5px]">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-[8.75px]">
            <span className="text-caption font-semibold">Attach screenshots</span>
            <span className="text-caption text-subtle">Optional · Up to {MAX_ATTACHMENTS} images</span>
          </div>
          <AttachmentPicker files={files} onChange={setFiles} />
          <p className="flex items-center gap-[6.25px] pt-[11.25px] text-caption text-muted-foreground">
            <ShieldCheckIcon className="size-[17.5px] shrink-0 text-success" aria-hidden />
            Please avoid uploading unnecessary sensitive personal information.
          </p>
        </div>

        <StepActions onBack={onBack} backLabel="Back to Support" nextLabel="Submit Request" nextType="submit" loading={isSubmitting} />
      </form>
    </Panel>
  )
}
