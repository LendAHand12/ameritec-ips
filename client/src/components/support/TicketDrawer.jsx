import { useEffect, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ArrowLeftRightIcon, InfoIcon, PaperclipIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ACCEPTED_IMAGE_TYPES } from '@/components/auth/DocumentUpload'
import { useAuth } from '@/hooks/useAuth'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { formatDateTime, formatDateTime24 } from '@/lib/format'
import { CATEGORY_LABEL, DESCRIPTION_MAX, mergeImageFiles } from '@/lib/support'
import { cn } from '@/lib/utils'
import { attachmentUrl, getTicket, replyToTicket } from '@/services/support.service'
import ImagePreview from './ImagePreview'
import { TicketStatusBadge } from './TicketStatusBadge'

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

function Message({ ticketId, message, userName, onPreview }) {
  const fromSupport = message.author === 'admin'
  return (
    <li className="flex gap-[11.25px] py-[15px]">
      <span
        aria-hidden
        className={cn(
          'flex size-[37.5px] shrink-0 items-center justify-center rounded-full text-caption font-bold',
          fromSupport ? 'bg-brand-muted text-white' : 'bg-primary-soft text-foreground',
        )}
      >
        {fromSupport ? 'AS' : initials(userName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center justify-between gap-x-3">
          <span className="text-caption font-bold">{fromSupport ? 'Ameritec Support' : 'You'}</span>
          <time dateTime={message.createdAt} className="text-caption text-subtle">
            {formatDateTime(message.createdAt)}
          </time>
        </p>
        <p
          className={cn(
            'mt-[7.5px] rounded-[10px] rounded-tl-none p-[12.5px] text-caption break-words whitespace-pre-wrap text-muted-foreground',
            fromSupport ? 'bg-muted' : 'bg-primary-soft',
          )}
        >
          {message.body}
        </p>
        {message.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-2" aria-label="Attachments">
            {message.attachments.map((a) => {
              const src = attachmentUrl(ticketId, a.id)
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onPreview({ src, name: a.name })}
                    aria-label={`View ${a.name}`}
                    className="block overflow-hidden rounded-lg border bg-muted transition hover:ring-3 hover:ring-ring/30 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <img src={src} alt={a.name} loading="lazy" className="h-[140px] w-auto max-w-[220px] object-cover" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </li>
  )
}

function PendingImage({ file, onRemove }) {
  const url = useObjectUrl(file)
  return (
    <li className="relative size-[60px] overflow-hidden rounded-lg border bg-muted">
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

function MetaItem({ children, last = false }) {
  return <span className={cn('text-caption text-muted-foreground', !last && 'border-r pr-[8.75px]')}>{children}</span>
}

/** Slide-over with a ticket's conversation; the investor can reply from here. */
export default function TicketDrawer({ ticketId, onClose, onUpdated }) {
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState(null)
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState(null)
  const fileInput = useRef(null)
  const listEnd = useRef(null)

  useEffect(() => {
    if (!ticketId) return
    setTicket(null)
    setError(null)
    setBody('')
    setFiles([])
    getTicket(ticketId)
      .then(({ ticket }) => setTicket(ticket))
      .catch(setError)
  }, [ticketId])

  // Keep the newest message in view
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' })
  }, [ticket?.messages.length])

  const pickFiles = (e) => {
    const result = mergeImageFiles(files, e.target.files ?? [])
    e.target.value = ''
    if (result.error) toast.error(result.error)
    setFiles(result.files)
  }

  const send = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      const { ticket: updated } = await replyToTicket(ticketId, body.trim(), files)
      setTicket(updated)
      setBody('')
      setFiles([])
      onUpdated?.()
    } catch (err) {
      toast.error(err.details?.body ?? err.details?.attachments ?? err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <DialogPrimitive.Root open={!!ticketId} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/42 duration-200 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[700px] flex-col bg-card px-5 pt-6 pb-5 shadow-[0_22.5px_31.25px_rgb(0_0_0/0.18)] outline-none duration-200 data-closed:animate-out data-closed:slide-out-to-right data-open:animate-in data-open:slide-in-from-right sm:px-[32.5px] sm:pt-[32.5px] sm:pb-[25px]">
          <div className="flex items-start justify-between gap-4 border-b pb-[27.5px]">
            <div className="min-w-0">
              <p className="pt-[5px] text-title font-semibold text-muted-foreground">{ticket?.ticketCode ?? ' '}</p>
              <DialogPrimitive.Title className="pt-[7.5px] text-subheading font-bold break-words">
                {ticket?.subject ?? (error ? 'Request not found' : 'Loading…')}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close render={<Button variant="outline" className="size-[50px] shrink-0 rounded-lg bg-card" aria-label="Close" />}>
              <XIcon className="size-[25px]" />
            </DialogPrimitive.Close>
          </div>

          {error && (
            <p className="py-10 text-center text-caption text-muted-foreground">
              {error.status === 404 ? 'This request doesn’t exist or isn’t yours.' : error.message}
            </p>
          )}
          {!ticket && !error && <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}

          {ticket && (
            <>
              <div className="flex flex-wrap items-center gap-[8.75px] border-b border-divider py-[15px]">
                <MetaItem>{CATEGORY_LABEL[ticket.category]}</MetaItem>
                <MetaItem>Created {formatDateTime24(ticket.createdAt)}</MetaItem>
                <TicketStatusBadge status={ticket.status} />
                {ticket.relatedTransaction && (
                  <span className="flex items-center gap-[5px] text-caption text-primary">
                    <ArrowLeftRightIcon className="size-[17.5px]" aria-hidden />
                    {ticket.relatedTransaction}
                  </span>
                )}
                {ticket.errorCode && <MetaItem last>Error {ticket.errorCode}</MetaItem>}
              </div>

              {ticket.status === 'waiting_for_user' && (
                <div className="mt-[15px] flex items-start gap-2.5 rounded-lg bg-violet-soft p-3 text-caption text-violet">
                  <InfoIcon className="mt-px size-4 shrink-0" />
                  <p>The support team is waiting for your reply.</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-[21.25px] pb-[11.25px]">
                <h3 className="text-caption">Support conversation</h3>
                <span className="text-caption text-muted-foreground">
                  {ticket.messages.length} {ticket.messages.length === 1 ? 'message' : 'messages'}
                </span>
              </div>

              <ol className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2" aria-label="Messages">
                {ticket.messages.map((m) => (
                  <Message key={m.id} ticketId={ticket.id} message={m} userName={user?.fullName} onPreview={setPreview} />
                ))}
                <li ref={listEnd} aria-hidden />
              </ol>

              <form onSubmit={send} className="mt-[12.5px] border-t pt-[15px]">
                <label htmlFor="ticket-reply" className="sr-only">
                  Reply
                </label>
                <textarea
                  id="ticket-reply"
                  value={body}
                  maxLength={DESCRIPTION_MAX}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={ticket.status === 'resolved' ? 'Write a reply to reopen this request...' : 'Write a reply...'}
                  className="block h-[93.75px] w-full resize-none rounded-lg border bg-card p-[11.25px] text-caption outline-none placeholder:text-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                {files.length > 0 && (
                  <ul className="flex flex-wrap gap-2 pt-2" aria-label="Images to send">
                    {files.map((f, i) => (
                      <PendingImage key={`${f.name}-${f.lastModified}-${i}`} file={f} onRemove={() => setFiles(files.filter((_, j) => j !== i))} />
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between gap-3 pt-[8.75px]">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex items-center gap-[6.25px] rounded-md py-1 text-caption text-muted-foreground hover:text-foreground"
                  >
                    <PaperclipIcon className="size-[18.75px]" aria-hidden />
                    Attach File
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={pickFiles}
                  />
                  <Button type="submit" className="min-h-[42.5px] px-[21.25px] text-title font-bold shadow-brand" disabled={sending || !body.trim()}>
                    {sending && <Spinner className="size-4" />}
                    Send Reply
                  </Button>
                </div>
              </form>
            </>
          )}
          <ImagePreview image={preview} onClose={() => setPreview(null)} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
