import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDownToLineIcon,
  ArrowLeftIcon,
  ArrowRightLeftIcon,
  CheckCircle2Icon,
  FlagIcon,
  ImageIcon,
  LifeBuoyIcon,
  PaperclipIcon,
  PlusCircleIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import StatusBadge from '@/components/dashboard/StatusBadge'
import ImagePreview from '@/components/support/ImagePreview'
import { ACCEPTED_IMAGE_TYPES } from '@/components/auth/DocumentUpload'
import { useAsync } from '@/hooks/useAsync'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { ACCOUNT_STATUS, KYC_STATUS } from '@/lib/adminUsers'
import { formatDateTime24, formatInt, formatUsdt } from '@/lib/format'
import { ORDER_STATUS } from '@/lib/orders'
import { ADMIN_TICKET_STATUS, CATEGORY_LABEL, DESCRIPTION_MAX, TICKET_PRIORITY, mergeImageFiles } from '@/lib/support'
import { cn } from '@/lib/utils'
import {
  addSupportNote,
  adminSupportAttachmentUrl,
  escalateSupportTicket,
  getSupportTicket,
  listSupportAgents,
  replySupportTicket,
  updateSupportTicket,
} from '@/services/admin.service'

const UNASSIGNED = '__none__'
const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
const textareaClass =
  'block w-full resize-y rounded-lg border bg-card p-[11.25px] text-sm outline-none placeholder:text-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'

function Card({ title, description, children, className }) {
  return (
    <section className={cn('rounded-xl border bg-card p-4 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)] sm:p-5', className)}>
      <h2 className="text-title font-semibold">{title}</h2>
      {description && <p className="pt-[5px] text-caption text-muted-foreground">{description}</p>}
      <div className="pt-[15px]">{children}</div>
    </section>
  )
}

function Rows({ rows }) {
  return (
    <dl className="space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-2.5 border-b border-divider pb-2.5 last:border-0 last:pb-0">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium break-words whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Avatar({ name, admin = false, size = 'size-[37.5px]' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-caption font-bold',
        size,
        admin ? 'bg-brand-muted text-white' : 'bg-primary-soft text-foreground',
      )}
    >
      {initials(name)}
    </span>
  )
}

function LabeledSelect({ label, value, options, onChange, disabled, className }) {
  return (
    <label className={cn('block space-y-[5px]', className)}>
      <span className="block text-caption font-semibold text-muted-foreground">{label}</span>
      <Select items={options} value={value} onValueChange={(v) => v != null && onChange(v)} disabled={disabled}>
        <SelectTrigger aria-label={label} className="h-[42.5px] w-full rounded-lg bg-card text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function PendingImage({ file, onRemove }) {
  const url = useObjectUrl(file)
  return (
    <li className="relative size-[56px] overflow-hidden rounded-lg border bg-muted">
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

/** Plain-language line for one activity entry. */
function activityText(a) {
  const status = (s) => ADMIN_TICKET_STATUS[s]?.label ?? s
  const priority = (p) => TICKET_PRIORITY[p]?.label ?? p
  switch (a.type) {
    case 'created':
      return 'Ticket created'
    case 'status':
      return `Status changed: ${status(a.from)} → ${status(a.to)}`
    case 'priority':
      return `Priority changed: ${priority(a.from)} → ${priority(a.to)}`
    case 'assignment':
      return a.to ? `Assigned to ${a.to}${a.from ? ` (was ${a.from})` : ''}` : `Unassigned${a.from ? ` from ${a.from}` : ''}`
    case 'escalated':
      return 'Ticket escalated'
    default:
      return a.type
  }
}
const ACTIVITY_ICON = { created: PlusCircleIcon, status: ArrowRightLeftIcon, priority: FlagIcon, assignment: UserRoundIcon, escalated: FlagIcon }

export default function AdminSupportTicketPage() {
  const { can } = useAdminAuth()
  const canManage = can('support:manage')
  const { id } = useParams()
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null) // which action is running
  const [reply, setReply] = useState('')
  const [files, setFiles] = useState([])
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState(null)
  const fileInput = useRef(null)
  const { data: agents } = useAsync(() => listSupportAgents().then((r) => r.data), [])

  useEffect(() => {
    getSupportTicket(id)
      .then(({ ticket }) => setTicket(ticket))
      .catch(setError)
  }, [id])

  /** Runs a ticket mutation, swaps in the returned ticket and reports the outcome. */
  const run = useCallback(async (key, fn, success) => {
    setBusy(key)
    try {
      const { ticket: updated } = await fn()
      setTicket(updated)
      if (success) toast.success(success)
      return true
    } catch (err) {
      toast.error(err.details?.body ?? err.details?.attachments ?? err.message)
      return false
    } finally {
      setBusy(null)
    }
  }, [])

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/admin/support" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeftIcon className="size-4" />
          Back to Ticket Inbox
        </Link>
        <p className="text-muted-foreground">{error.status === 404 ? 'This ticket doesn’t exist.' : error.message}</p>
      </div>
    )
  }
  if (!ticket) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  const resolved = ticket.status === 'resolved'
  const investorAttachments = ticket.messages.filter((m) => m.author === 'user').flatMap((m) => m.attachments)
  const update = (patch, label) => run('update', () => updateSupportTicket(ticket.id, patch), label)
  const agentOptions = [{ value: UNASSIGNED, label: 'Unassigned' }, ...(agents ?? []).map((a) => ({ value: a.id, label: a.fullName }))]

  const sendReply = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    if (await run('reply', () => replySupportTicket(ticket.id, reply.trim(), files), 'Reply sent')) {
      setReply('')
      setFiles([])
    }
  }
  const saveNote = async (e) => {
    e.preventDefault()
    if (!note.trim()) return
    if (await run('note', () => addSupportNote(ticket.id, note.trim()), 'Note added')) setNote('')
  }
  const pickFiles = (e) => {
    const result = mergeImageFiles(files, e.target.files ?? [])
    e.target.value = ''
    if (result.error) toast.error(result.error)
    setFiles(result.files)
  }

  return (
    <>
      {/* Header */}
      <section className="rounded-xl border bg-card p-4 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)] sm:p-5">
        <Link to="/admin/support" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" />
          Back to Ticket Inbox
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-5 pt-4">
          <div className="flex min-w-0 flex-[1_1_280px] items-center gap-2.5">
            <span className="flex size-[37.5px] shrink-0 items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
              <LifeBuoyIcon className="size-[22px]" />
            </span>
            <div className="min-w-0">
              <p className="text-caption text-muted-foreground">Support Ticket</p>
              <h1 className="text-[22px] leading-tight font-bold sm:text-[26px]">{ticket.ticketCode}</h1>
              <p className="pt-0.5 text-title break-words text-muted-foreground">{ticket.subject}</p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2.5 sm:w-auto sm:grid-cols-[200px_140px_180px]">
            <LabeledSelect
              label="Status"
              value={ticket.status}
              options={Object.entries(ADMIN_TICKET_STATUS).map(([value, s]) => ({ value, label: s.label }))}
              onChange={(v) => v !== ticket.status && update({ status: v }, 'Status updated')}
              disabled={busy === 'update' || !canManage}
            />
            <LabeledSelect
              label="Priority"
              value={ticket.priority}
              options={Object.entries(TICKET_PRIORITY).map(([value, p]) => ({ value, label: p.label }))}
              onChange={(v) => v !== ticket.priority && update({ priority: v }, 'Priority updated')}
              disabled={busy === 'update' || !canManage}
            />
            <LabeledSelect
              label="Assigned To"
              value={ticket.assignedTo?.id ?? UNASSIGNED}
              options={agentOptions}
              onChange={(v) => {
                const next = v === UNASSIGNED ? null : v
                if (next !== (ticket.assignedTo?.id ?? null)) update({ assignedTo: next }, next ? 'Ticket assigned' : 'Ticket unassigned')
              }}
              disabled={busy === 'update' || !agents || !canManage}
            />
          </div>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-[30px] gap-y-1.5 border-t border-divider pt-4 text-sm">
          {[
            ['Created', formatDateTime24(ticket.createdAt)],
            ['Last Updated', formatDateTime24(ticket.lastActivityAt)],
            ['Assigned To', ticket.assignedTo?.fullName ?? 'Unassigned'],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
          {ticket.escalatedAt && (
            <div className="flex items-center">
              <StatusBadge tone="danger" icon={false}>
                Escalated {formatDateTime24(ticket.escalatedAt)}
              </StatusBadge>
            </div>
          )}
        </dl>
      </section>

{canManage && (
      <div className="flex flex-wrap justify-end gap-2.5 pt-2.5">
        <Button
          variant="outline"
          className="h-[42.5px] rounded-lg bg-card px-[17.5px] font-bold"
          disabled={!!ticket.escalatedAt || resolved || !!busy}
          onClick={() => run('escalate', () => escalateSupportTicket(ticket.id), 'Ticket escalated')}
        >
          {busy === 'escalate' ? <Spinner className="size-4" /> : <FlagIcon />}
          {ticket.escalatedAt ? 'Escalated' : 'Escalate'}
        </Button>
        <Button
          className="h-[42.5px] rounded-lg px-[17.5px] font-bold shadow-brand"
          disabled={!!busy}
          onClick={() => update({ status: resolved ? 'in_progress' : 'resolved' }, resolved ? 'Ticket reopened' : 'Ticket resolved')}
        >
          {busy === 'update' ? <Spinner className="size-4" /> : <CheckCircle2Icon />}
          {resolved ? 'Reopen Ticket' : 'Resolve Ticket'}
        </Button>
      </div>
)}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2.5 pt-2.5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-2.5">
          {/* Conversation */}
          <Card title="Support Conversation" description="Public messages visible to the investor.">
            <ol className="space-y-[15px]">
              {ticket.messages.map((m) => {
                const fromAdmin = m.author === 'admin'
                return (
                  <li key={m.id} className={cn('flex gap-2.5', fromAdmin ? 'flex-row-reverse pl-6 sm:pl-[15%]' : 'pr-6 sm:pr-[15%]')}>
                    <Avatar name={m.authorName} admin={fromAdmin} />
                    <div className={cn('min-w-0 flex-1 rounded-lg border p-[11px]', fromAdmin ? 'border-primary/15 bg-primary-soft/50' : 'bg-muted')}>
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-bold">{m.authorName}</span>
                        <time dateTime={m.createdAt} className="text-caption text-subtle">
                          {formatDateTime24(m.createdAt)}
                        </time>
                      </p>
                      <p className="pt-1.5 text-sm break-words whitespace-pre-wrap text-muted-foreground">{m.body}</p>
                      {m.attachments.length > 0 && (
                        <ul className="flex flex-wrap gap-2 pt-2.5" aria-label="Attachments">
                          {m.attachments.map((a) => {
                            const src = adminSupportAttachmentUrl(ticket.id, a.id)
                            return (
                              <li key={a.id}>
                                <button
                                  type="button"
                                  onClick={() => setPreview({ src, name: a.name })}
                                  aria-label={`View ${a.name}`}
                                  className="block overflow-hidden rounded-lg border bg-card hover:ring-3 hover:ring-ring/30"
                                >
                                  <img src={src} alt={a.name} loading="lazy" className="h-[110px] w-auto max-w-[180px] object-cover" />
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>

{canManage && (
            <form onSubmit={sendReply} className="mt-5 rounded-lg border p-[13.75px]">
              <label htmlFor="public-reply" className="block text-caption font-semibold tracking-wide text-muted-foreground uppercase">
                Public Reply
              </label>
              <textarea
                id="public-reply"
                rows={3}
                value={reply}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply to investor…"
                className={cn(textareaClass, 'mt-2.5 min-h-[90px]')}
              />
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-2" aria-label="Images to send">
                  {files.map((f, i) => (
                    <PendingImage key={`${f.name}-${i}`} file={f} onRemove={() => setFiles(files.filter((_, j) => j !== i))} />
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <PaperclipIcon className="size-[18px]" />
                  Attachment
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
                <span className="flex items-center gap-3">
                  <span className="hidden text-caption text-subtle sm:inline">Status becomes “Waiting for User”</span>
                  <Button
                    type="submit"
                    className="h-[42.5px] rounded-lg px-[17.5px] font-bold shadow-brand"
                    disabled={busy === 'reply' || !reply.trim()}
                  >
                    {busy === 'reply' && <Spinner className="size-4" />}
                    Send Reply
                  </Button>
                </span>
              </div>
            </form>
)}
          </Card>

          {/* Internal notes */}
          <Card title="Internal Notes" description="Internal only — not visible to investor.">
            {ticket.notes.length > 0 && (
              <ol className="mb-[15px] space-y-2.5">
                {ticket.notes.map((n) => (
                  <li key={n.id} className="flex gap-2.5 rounded-lg bg-warning-soft/60 p-2.5">
                    <Avatar name={n.authorName} admin />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-bold">{n.authorName}</span>
                        <time dateTime={n.createdAt} className="text-caption text-subtle">
                          {formatDateTime24(n.createdAt)}
                        </time>
                      </p>
                      <p className="pt-1 text-sm break-words whitespace-pre-wrap text-muted-foreground">{n.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
{canManage && (
            <form onSubmit={saveNote}>
              <label htmlFor="internal-note" className="sr-only">
                Internal note
              </label>
              <textarea
                id="internal-note"
                rows={3}
                value={note}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an internal operational note…"
                className={cn(textareaClass, 'min-h-[90px]')}
              />
              <Button
                type="submit"
                variant="outline"
                className="mt-2.5 h-[42.5px] rounded-lg bg-card px-[17.5px] font-bold"
                disabled={busy === 'note' || !note.trim()}
              >
                {busy === 'note' && <Spinner className="size-4" />}
                Add Internal Note
              </Button>
            </form>
)}
          </Card>

          {/* Activity */}
          <Card title="Ticket Activity" description="Immutable support operations timeline.">
            <ol>
              {ticket.activity.map((a) => {
                const Icon = ACTIVITY_ICON[a.type] ?? ArrowRightLeftIcon
                return (
                  <li key={a.id} className="flex items-center gap-2.5 border-b border-divider py-2.5 last:border-0">
                    <span className="flex size-[35px] shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{activityText(a)}</p>
                      <p className="text-caption text-muted-foreground">
                        {a.actorName ?? 'System'}
                        {a.actorType === 'investor' && ' · Investor'}
                      </p>
                    </div>
                    <time dateTime={a.createdAt} className="shrink-0 text-caption text-muted-foreground">
                      {formatDateTime24(a.createdAt)}
                    </time>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-2.5">
          {ticket.investor && (
            <Card title="Investor" description="Masked account context">
              <div className="flex items-center gap-2.5">
                <Avatar name={ticket.investor.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{ticket.investor.fullName}</p>
                  <p className="text-caption text-muted-foreground">{ticket.investor.referralCode}</p>
                </div>
                <Link
                  to={`/admin/users?q=${encodeURIComponent(ticket.investor.referralCode ?? '')}`}
                  className="flex h-[35px] items-center rounded-lg border bg-card px-3 text-caption font-bold transition-colors hover:bg-muted"
                >
                  View User
                </Link>
              </div>
              <div className="pt-[15px]">
                <Rows
                  rows={[
                    [
                      'KYC',
                      <StatusBadge key="k" tone={KYC_STATUS[ticket.investor.kycStatus]?.tone} icon={false}>
                        {KYC_STATUS[ticket.investor.kycStatus]?.label ?? ticket.investor.kycStatus}
                      </StatusBadge>,
                    ],
                    [
                      'Account',
                      <StatusBadge key="a" tone={ACCOUNT_STATUS[ticket.investor.accountStatus]?.tone} icon={false}>
                        {ACCOUNT_STATUS[ticket.investor.accountStatus]?.label ?? ticket.investor.accountStatus}
                      </StatusBadge>,
                    ],
                    ['Email', ticket.investor.maskedEmail],
                  ]}
                />
              </div>
            </Card>
          )}

          <Card title="Issue Information" description="Investor-reported issue">
            <Rows
              rows={[
                ['Issue Type', CATEGORY_LABEL[ticket.category]],
                ['Subject', ticket.subject],
                ['Description', ticket.messages[0]?.body ?? '—'],
                ['Error Code', ticket.errorCode ? <span className="font-semibold text-primary">{ticket.errorCode}</span> : '—'],
                ['Related Transaction', ticket.relatedTransaction ?? '—'],
              ]}
            />
          </Card>

          {ticket.relatedTransaction && (
            <Card title="Related Transaction" description="Read-only transaction preview">
              {ticket.relatedOrder ? (
                <>
                  <Rows
                    rows={[
                      ['Transaction ID', ticket.relatedOrder.orderCode],
                      ['Amount', `${formatUsdt(ticket.relatedOrder.amount)} USDT`],
                      ['Class', `Class ${ticket.relatedOrder.shareType}`],
                      ['Shares', formatInt(ticket.relatedOrder.shares)],
                      [
                        'Status',
                        <StatusBadge key="s" tone={ORDER_STATUS[ticket.relatedOrder.status]?.tone}>
                          {ORDER_STATUS[ticket.relatedOrder.status]?.label ?? ticket.relatedOrder.status}
                        </StatusBadge>,
                      ],
                    ]}
                  />
                  <Link
                    to={`/admin/transactions?q=${encodeURIComponent(ticket.relatedOrder.orderCode)}`}
                    className="mt-[15px] flex h-[42.5px] items-center justify-center rounded-lg border bg-card text-sm font-bold transition-colors hover:bg-muted"
                  >
                    View Transaction
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No order <b className="text-foreground">{ticket.relatedTransaction}</b> was found for this investor.
                </p>
              )}
            </Card>
          )}

          <Card title="Attachments" description="Original investor uploads">
            {investorAttachments.length ? (
              <ul className="space-y-2">
                {investorAttachments.map((a) => {
                  const src = adminSupportAttachmentUrl(ticket.id, a.id)
                  return (
                    <li key={a.id} className="flex items-center gap-2.5 rounded-lg border p-2.5">
                      <button
                        type="button"
                        onClick={() => setPreview({ src, name: a.name })}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span className="flex size-[37.5px] shrink-0 items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
                          <ImageIcon className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{a.name}</span>
                          <span className="block text-caption text-muted-foreground">Preview or download</span>
                        </span>
                      </button>
                      <a
                        href={src}
                        download={a.name}
                        aria-label={`Download ${a.name}`}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      >
                        <ArrowDownToLineIcon className="size-5" />
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No attachments.</p>
            )}
          </Card>
        </aside>
      </div>

      <ImagePreview image={preview} onClose={() => setPreview(null)} />
    </>
  )
}
