import { useId, useState } from 'react'
import { ArrowDownToLineIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_MB } from '@/components/auth/DocumentUpload'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { MAX_ATTACHMENTS, mergeImageFiles } from '@/lib/support'
import { cn } from '@/lib/utils'

function Thumb({ file, onRemove }) {
  const url = useObjectUrl(file)
  return (
    <li className="relative size-[72px] overflow-hidden rounded-lg border bg-card">
      {url && <img src={url} alt={file.name} className="size-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground"
      >
        <XIcon className="size-3.5" />
      </button>
    </li>
  )
}

/** Dashed drop zone for up to MAX_ATTACHMENTS screenshots, with thumbnails. */
export default function AttachmentPicker({ files, onChange }) {
  const id = useId()
  const [dragging, setDragging] = useState(false)
  const remaining = MAX_ATTACHMENTS - files.length

  const add = (list) => {
    const result = mergeImageFiles(files, list)
    if (result.error) toast.error(result.error)
    if (result.files.length !== files.length) onChange(result.files)
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          add(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer items-center justify-center gap-[12.5px] rounded-lg border border-dashed border-border-strong bg-muted px-4 transition-colors hover:border-primary hover:bg-primary-soft/40 has-[:focus-visible]:border-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30',
          'min-h-[95px] py-4',
          dragging && 'border-primary bg-primary-soft/40',
          remaining <= 0 && 'pointer-events-none opacity-50',
        )}
      >
        <span className="mb-[2.5px] flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-primary">
          <ArrowDownToLineIcon className="size-[25px]" />
        </span>
        <span className="space-y-[3.75px]">
          <span className="block text-caption font-bold">Drop screenshots here or browse</span>
          <span className="block text-caption text-muted-foreground">JPG, PNG or WEBP · Max {MAX_IMAGE_SIZE_MB} MB each</span>
        </span>
        <input
          id={id}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="sr-only"
          disabled={remaining <= 0}
          onChange={(e) => {
            add(e.target.files ?? [])
            e.target.value = ''
          }}
        />
      </label>
      {files.length ? (
        <ul className="flex flex-wrap gap-2.5 pt-2.5" aria-label="Attachments">
          {files.map((f, i) => (
            <Thumb key={`${f.name}-${f.lastModified}-${i}`} file={f} onRemove={() => onChange(files.filter((_, j) => j !== i))} />
          ))}
        </ul>
      ) : (
        <p className="pt-2.5 text-center text-caption text-subtle">No attachments added</p>
      )}
    </div>
  )
}
