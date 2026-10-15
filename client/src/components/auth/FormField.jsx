import { Field, FieldError, FieldLabel } from '@/components/ui/field'

/** Field with the design's label row: title on the left, "Required"/"Optional" on the right. */
export default function FormField({ id, label, required = false, error, description, labelSize = 'title', children, className }) {
  return (
    <Field data-invalid={!!error} className={className}>
      <div className="flex min-h-[21.25px] items-start justify-between gap-2">
        <FieldLabel htmlFor={id} className={labelSize === 'caption' ? 'text-caption font-semibold' : 'text-title font-semibold'}>
          {label}
        </FieldLabel>
        <span className={required ? 'text-caption font-semibold text-primary' : 'text-caption font-semibold text-subtle'}>
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      {children}
      {description}
      <FieldError errors={[error]} />
    </Field>
  )
}
