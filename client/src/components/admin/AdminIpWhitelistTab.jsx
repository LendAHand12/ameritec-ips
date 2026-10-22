import { useEffect, useState } from 'react'
import { GlobeIcon, PlusIcon, ShieldAlertIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAsync } from '@/hooks/useAsync'
import { formatDateTime24 } from '@/lib/format'
import { cn } from '@/lib/utils'
import * as adminService from '@/services/admin.service'

const th = 'border-y border-divider bg-muted px-[15px] py-[12.5px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-[15px] py-[12.5px] text-caption'

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[26px] w-[48px] shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60',
        checked ? 'bg-success' : 'bg-border',
      )}
    >
      <span className={cn('absolute top-[3px] left-[3px] size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-[22px]')} />
    </button>
  )
}

/** Settings → IP Whitelist (super admin): when on, only these addresses can open the admin portal. */
export default function AdminIpWhitelistTab() {
  const { data } = useAsync(() => adminService.getIpWhitelist().then((r) => r.data), [])
  const [enabled, setEnabled] = useState(false)
  const [entries, setEntries] = useState([])
  const [ip, setIp] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null) // what the server has, to know when there are unsaved changes

  const apply = (d) => {
    setEnabled(d.enabled)
    setEntries(d.entries)
    setSaved({ enabled: d.enabled, entries: d.entries.map((e) => `${e.ip}|${e.note}`).join('\n') })
  }
  useEffect(() => {
    if (data) apply(data)
  }, [data])

  if (!data || !saved) return <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />
  const currentIp = data.currentIp
  const dirty = enabled !== saved.enabled || entries.map((e) => `${e.ip}|${e.note}`).join('\n') !== saved.entries
  const hasMine = entries.some((e) => e.ip === currentIp)

  const add = (value = ip, text = note) => {
    const v = value.trim()
    if (!v) return setError('Enter an IP address')
    if (entries.some((e) => e.ip === v)) return setError('That address is already in the list')
    setEntries((list) => [...list, { ip: v, note: text.trim(), addedAt: null }])
    setIp('')
    setNote('')
    setError('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const { data: next } = await adminService.updateIpWhitelist({ enabled, entries: entries.map((e) => ({ ip: e.ip, note: e.note || undefined })) })
      apply(next)
      toast.success(next.enabled ? 'IP whitelist is on' : 'IP whitelist saved (off)')
    } catch (err) {
      const field = Object.entries(err.details ?? {}).find(([k]) => k.startsWith('entries.'))
      setError(field ? `${entries[Number(field[0].split('.')[1])]?.ip}: ${field[1]}` : err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-[15px]">
        <h2 className="text-subheading font-semibold">IP Whitelist</h2>
        <p className="text-title text-muted-foreground">Only the addresses below can open the admin portal — sign-in included. Everyone else is blocked, even with the right password.</p>
      </div>

      <article className="mt-[10px] flex flex-wrap items-center gap-4 rounded-[15px] border bg-card p-5 shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)]">
        <span className="flex size-[37.5px] shrink-0 items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
          <GlobeIcon className="size-[21px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-subheading font-semibold">Restrict admin access by IP</h3>
          <p className="text-title text-muted-foreground">
            Your current IP: <span className="font-mono font-semibold text-foreground">{currentIp}</span>
            {enabled && !hasMine && <span className="font-semibold text-warning"> — not in the list yet</span>}
          </p>
        </div>
        <Switch checked={enabled} onChange={setEnabled} label="Turn the IP whitelist on" disabled={saving} />
      </article>

      <section className="mt-[10px] overflow-hidden rounded-[15px] border bg-card shadow-[0_1.25px_2.5px_rgb(0_0_0/0.04)]">
        <div className="flex flex-wrap items-center gap-[10px] border-b border-divider p-4">
          <Input
            value={ip}
            onChange={(e) => (setIp(e.target.value), setError(''))}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            placeholder="IP address or range, e.g. 203.0.113.7 or 203.0.113.0/24"
            className="h-10 min-w-[260px] flex-1 font-mono text-sm"
            spellCheck={false}
            aria-label="IP address"
          />
          <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="Note (e.g. Office)" maxLength={100} className="h-10 w-[200px]" aria-label="Note" />
          <Button type="button" className="h-10 font-bold" onClick={() => add()}>
            <PlusIcon />
            Add
          </Button>
          {!hasMine && (
            <Button type="button" variant="outline" className="h-10 bg-card font-semibold" onClick={() => add(currentIp, 'My current IP')}>
              Add my current IP
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                <th className={cn(th, 'pl-5')}>IP address / range</th>
                <th className={th}>Note</th>
                <th className={th}>Added</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.ip}>
                  <td className={cn(td, 'pl-5 font-mono text-sm font-semibold')}>
                    {e.ip}
                    {e.ip === currentIp && <span className="ml-2 rounded-md bg-success-soft px-1.5 py-0.5 font-sans text-caption font-semibold text-success">You</span>}
                  </td>
                  <td className={cn(td, 'text-muted-foreground')}>{e.note || '—'}</td>
                  <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{e.addedAt ? formatDateTime24(e.addedAt) : 'Not saved yet'}</td>
                  <td className={cn(td, 'text-right')}>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${e.ip}`} onClick={() => setEntries((list) => list.filter((x) => x.ip !== e.ip))}>
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!entries.length && <p className="py-10 text-center text-caption text-muted-foreground">No addresses yet. The whitelist can’t be turned on until you add at least one — start with your own.</p>}
        </div>
      </section>

      {error && (
        <p className="mt-[10px] flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-caption text-danger" role="alert">
          <ShieldAlertIcon className="mt-px size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-[10px] flex flex-wrap items-center gap-3">
        <Button className="h-[46px] px-5 text-title font-bold" onClick={save} disabled={saving || !dirty}>
          {saving && <Spinner />}
          Save changes
        </Button>
        {dirty && <span className="text-caption text-muted-foreground">You have unsaved changes.</span>}
      </div>
      <p className="pt-3 text-caption text-muted-foreground">
        Turning it on checks that your own IP is in the list, so you can’t lock yourself out. If you ever are locked out, an engineer can switch it off in the database (<code>adminIpWhitelist.enabled</code> in the settings document).
      </p>
    </>
  )
}
