import { useEffect, useState } from 'react'
import { MegaphoneIcon, SearchIcon, SendIcon, UserRoundIcon, UsersIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { useAsync } from '@/hooks/useAsync'
import { formatDateTime24, formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import * as adminService from '@/services/admin.service'

const th = 'border-y border-divider bg-muted px-2.5 py-[11.25px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-2.5 py-[11.25px] align-top text-caption'

function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-caption font-semibold">{label}</span>
      {children}
      {error ? <span className="block text-sm text-destructive">{error}</span> : hint && <span className="block text-caption text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** Pick one user by typing part of their name, email, phone or referral code. */
function RecipientPicker({ value, onChange, error }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return undefined
    }
    setSearching(true)
    const timer = setTimeout(() => {
      adminService
        .searchNotificationRecipients(query.trim())
        .then((r) => setResults(r.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted px-3 py-2.5">
        <span className="min-w-0 text-sm">
          <span className="block truncate font-semibold">{value.fullName}</span>
          <span className="block truncate text-caption text-muted-foreground">
            {value.email} · {value.referralCode}
          </span>
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Choose another user" onClick={() => onChange(null)}>
          <XIcon />
        </Button>
      </div>
    )
  }
  return (
    <div className="relative">
      <label className={cn('flex h-10 items-center gap-2.5 rounded-lg border bg-card px-3 focus-within:ring-3 focus-within:ring-ring/30', error && 'border-destructive')}>
        <SearchIcon className="size-4 shrink-0 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone or ref code"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
          aria-label="Search for a user"
        />
        {searching && <Spinner className="size-4" />}
      </label>
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          {results.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => onChange(u)} className="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted">
                <span className="block font-semibold">{u.fullName}</span>
                <span className="block text-caption text-muted-foreground">
                  {u.email} · {u.referralCode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !searching && results.length === 0 && <p className="pt-1.5 text-caption text-muted-foreground">No users match “{query.trim()}”.</p>}
    </div>
  )
}

function Compose({ canManage, onSent }) {
  const [audience, setAudience] = useState('user')
  const [recipient, setRecipient] = useState(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  const validate = () => {
    const next = {}
    if (audience === 'user' && !recipient) next.userId = 'Choose a user'
    if (title.trim().length < 3) next.title = 'Enter a title (3+ characters)'
    if (!message.trim()) next.message = 'Enter the message'
    setErrors(next)
    return !Object.keys(next).length
  }

  const submit = (e) => {
    e.preventDefault()
    if (!validate()) return
    // A message to everyone can't be recalled, so it asks for one more confirmation
    if (audience === 'all') setConfirming(true)
    else send()
  }

  const send = async () => {
    setSending(true)
    try {
      await adminService.sendNotification({ audience, userId: recipient?.id, title: title.trim(), message: message.trim() })
      toast.success(audience === 'all' ? 'Sent to everyone' : `Sent to ${recipient.fullName}`)
      setTitle('')
      setMessage('')
      setRecipient(null)
      setConfirming(false)
      onSent()
    } catch (err) {
      setErrors(err.details ?? {})
      setConfirming(false)
      if (!err.details) toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-[11.25px] border bg-card p-5 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
      <h2 className="text-subheading font-semibold">New notification</h2>
      <p className="text-caption text-muted-foreground">Appears under the bell in the user’s portal until they read it.</p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <Field label="Send to">
          <div role="radiogroup" aria-label="Audience" className="grid gap-2 sm:grid-cols-2">
            {[
              ['user', 'One user', UserRoundIcon],
              ['all', 'Everyone', UsersIcon],
            ].map(([value, label, icon]) => {
              const Icon = icon
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={audience === value}
                  onClick={() => {
                    setAudience(value)
                    setErrors({})
                  }}
                  className={cn(
                    'flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                    audience === value ? 'border-primary bg-primary-soft text-primary' : 'bg-card text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              )
            })}
          </div>
        </Field>

        {audience === 'user' && (
          <Field label="User" error={errors.userId}>
            <RecipientPicker
              value={recipient}
              onChange={(u) => {
                setRecipient(u)
                setErrors((x) => ({ ...x, userId: undefined }))
              }}
              error={errors.userId}
            />
          </Field>
        )}

        <Field label="Title" error={errors.title}>
          <Input value={title} onChange={(e) => (setTitle(e.target.value), setErrors((x) => ({ ...x, title: undefined })))} maxLength={100} placeholder="e.g. Scheduled maintenance on Friday" aria-invalid={!!errors.title} />
        </Field>
        <Field label="Message" error={errors.message} hint={`${message.length} / 2000`}>
          <Textarea value={message} onChange={(e) => (setMessage(e.target.value), setErrors((x) => ({ ...x, message: undefined })))} rows={5} maxLength={2000} placeholder="What you want the user to know" aria-invalid={!!errors.message} />
        </Field>

        <Button type="submit" className="h-[46px] px-5 text-title font-bold" disabled={!canManage || sending}>
          {sending ? <Spinner /> : <SendIcon />}
          Send notification
        </Button>
        {!canManage && <p className="text-caption text-muted-foreground">You can view sent notifications but not send new ones.</p>}
      </form>

      <Dialog open={confirming} onOpenChange={(o) => !o && !sending && setConfirming(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">Send to everyone?</DialogTitle>
            <DialogDescription>“{title.trim()}” will appear for every user. It can’t be recalled once sent.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={sending}>
              {sending && <Spinner />}
              Send to everyone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default function AdminNotificationsPage() {
  const { can } = useAdminAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: sent } = useAsync(() => adminService.listSentNotifications().then((r) => r.data), [reloadKey])

  return (
    <>
      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">Notifications</h1>
        <p className="pt-[6.25px] text-title text-muted-foreground">Send a message to one user or to everyone.</p>
      </div>

      <div className="mt-[18.75px] grid items-start gap-[17.5px] xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <Compose canManage={can('notifications:manage')} onSent={() => setReloadKey((k) => k + 1)} />

        <section className="overflow-hidden rounded-[11.25px] border bg-card shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
          <div className="border-b border-divider px-5 py-4">
            <h2 className="text-subheading font-semibold">Sent</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className={`${th} pl-5`}>Message</th>
                  <th className={th}>To</th>
                  <th className={th}>Read</th>
                  <th className={th}>Sent</th>
                </tr>
              </thead>
              <tbody>
                {(sent ?? []).map((n) => (
                  <tr key={n.id}>
                    <td className={`${td} max-w-[320px] pl-5`}>
                      <p className="text-title font-semibold">{n.title}</p>
                      <p className="line-clamp-2 text-muted-foreground">{n.message}</p>
                    </td>
                    <td className={td}>
                      {n.audience === 'all' ? (
                        <StatusBadge tone="brand" icon={false} className="h-[26px]">
                          <MegaphoneIcon className="size-3.5" />
                          Everyone
                        </StatusBadge>
                      ) : (
                        <>
                          <p className="font-semibold">{n.recipient?.fullName ?? 'Deleted user'}</p>
                          <p className="text-muted-foreground">{n.recipient?.email}</p>
                        </>
                      )}
                    </td>
                    <td className={`${td} tabular-nums whitespace-nowrap`}>
                      {formatInt(n.readCount)} / {formatInt(n.recipients)}
                    </td>
                    <td className={`${td} whitespace-nowrap text-muted-foreground`}>
                      {formatDateTime24(n.createdAt)}
                      {n.sentBy && <span className="block">by {n.sentBy}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sent && <Spinner className="mx-auto my-12 size-6 text-muted-foreground" />}
            {sent && !sent.length && <p className="py-10 text-center text-caption text-muted-foreground">Nothing sent yet.</p>}
          </div>
        </section>
      </div>
    </>
  )
}
