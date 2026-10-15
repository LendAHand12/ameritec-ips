import { useId } from 'react'
import { ArrowDownToLineIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { cn } from '@/lib/utils'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_SIZE_MB = 10

export function validateImageFile(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Only JPG, PNG or WEBP images are allowed'
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) return `Image must be smaller than ${MAX_IMAGE_SIZE_MB} MB`
  return null
}

/**
 * Labelled upload box with preview. Calls onChange(file | null) or onError(message).
 * On phones the file picker also offers the camera.
 */
export default function DocumentUpload({ label, uploadLabel = `Upload ${label}`, required = false, file, onChange, onError, error, className }) {
  const id = useId()
  const previewUrl = useObjectUrl(file)

  const handleChange = (e) => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return
    const message = validateImageFile(selected)
    if (message) onError?.(message)
    else onChange(selected)
  }

  return (
    <Field data-invalid={!!error} className={cn('gap-0', className)}>
      <div className="flex min-h-[25px] items-start justify-between gap-2">
        <label htmlFor={id} className="text-caption font-semibold">{label}</label>
        <span className={cn('text-caption font-semibold', required ? 'text-primary' : 'text-subtle')}>
          {required ? 'Required' : 'Optional'}
        </span>
      </div>

      <div className="relative">
        <label
          htmlFor={id}
          className={cn(
            'flex h-[187.5px] cursor-pointer flex-col items-center justify-center gap-[6.25px] overflow-hidden rounded-lg border border-dashed border-border-strong bg-muted px-4 text-center transition-colors hover:border-primary hover:bg-primary-soft/40 has-[:focus-visible]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30',
            error && 'border-destructive',
            previewUrl && 'border-solid bg-card p-0',
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={`${label} preview`} className="size-full object-contain" />
          ) : (
            <>
              <span className="mb-[2.5px] flex size-10 items-center justify-center rounded-full border bg-card text-primary">
                <ArrowDownToLineIcon className="size-[25px]" />
              </span>
              <span className="text-caption font-bold">{uploadLabel}</span>
              <span className="text-caption text-subtle">JPG, PNG or WEBP · Max {MAX_IMAGE_SIZE_MB} MB</span>
              <span className="pt-[2.5px] text-caption font-semibold text-primary">Use camera or browse files</span>
            </>
          )}
          <input id={id} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="sr-only" onChange={handleChange} />
        </label>

        {file && (
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-md bg-background/90 py-1 pr-1 pl-2.5 shadow-sm backdrop-blur">
            <span className="flex-1 truncate text-caption">{file.name}</span>
            <label htmlFor={id} className="cursor-pointer text-caption font-semibold text-primary hover:underline">
              Replace
            </label>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove ${label}`} onClick={() => onChange(null)}>
              <XIcon />
            </Button>
          </div>
        )}
      </div>

      <FieldError className="mt-1.5">{error}</FieldError>
    </Field>
  )
}
