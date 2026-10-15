import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ArrowRightIcon, ShieldCheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatDateTime24, formatTime24 } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getAuditLog } from '@/services/admin.service'

const show = (v) => (v === true ? 'On' : v === false ? 'Off' : v == null || v === '' ? '—' : String(v))
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)
const fmtNumber = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

function Section({ title, description, children }) {
  return (
    <section className="border-b border-divider px-5 py-5 last:border-0">
      <div className={cn(description && 'border-b border-divider pb-[13.75px]')}>
        <h3 className="text-title font-semibold">{title}</h3>
        {description && <p className="pt-[5px] text-caption text-muted-foreground">{description}</p>}
      </div>
      <div className="pt-[15px]">{children}</div>
    </section>
  )
}

/** Two-column label/value rows, as in "Related Record" and "Operational Context". */
function Rows({ rows }) {
  return (
    <dl>
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-2.5 border-b border-divider py-2.5 first:pt-0">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-sm font-semibold break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Before → After card; numeric changes also show the delta. */
function ChangeCard({ change }) {
  const numeric = isNumber(change.from) && isNumber(change.to)
  const delta = numeric ? change.to - change.from : null
  return (
    <div className="rounded-lg border bg-muted p-[15px]">
      <p className="pb-2 text-caption font-semibold text-muted-foreground">{change.field}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)] items-center gap-[15px]">
        <div>
          <p className="text-caption text-muted-foreground">Before</p>
          <p className="text-subheading font-bold break-words">{numeric ? fmtNumber(change.from) : show(change.from)}</p>
        </div>
        <div className="text-center">
          {numeric && (
            <>
              <p className="text-caption text-muted-foreground">Change</p>
              <p className={cn('text-subheading font-bold', delta >= 0 ? 'text-success' : 'text-destructive')}>
                {delta > 0 ? '+' : ''}
                {fmtNumber(delta)}
              </p>
            </>
          )}
        </div>
        <ArrowRightIcon className="size-5 text-muted-foreground" aria-label="changed to" />
        <div className="text-right">
          <p className="text-caption text-muted-foreground">After</p>
          <p className="text-subheading font-bold break-words">{numeric ? fmtNumber(change.to) : show(change.to)}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Read-only detail of one audit event. `log` is the list row (shown immediately);
 * the full entry with its related-activity timeline is loaded on open.
 */
export default function AuditLogDrawer({ log, recordLink, onClose }) {
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!log) return
    setDetail(null)
    getAuditLog(log.id)
      .then((r) => setDetail(r.data))
      .catch(() => setDetail({ ...log, timeline: null }))
  }, [log])

  const e = detail ?? log
  const link = e?.record && recordLink(e.record)

  return (
    <DialogPrimitive.Root open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/42 duration-200 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[760px] flex-col bg-card shadow-[0_22.5px_62.5px_rgb(0_0_0/0.18)] outline-none duration-200 data-closed:animate-out data-closed:slide-out-to-right data-open:animate-in data-open:slide-in-from-right">
          {e && (
            <>
              <div className="flex items-start justify-between gap-4 border-b px-5 pt-6 pb-5 sm:px-[32.5px]">
                <div className="min-w-0">
                  <p className="text-caption tracking-wide text-muted-foreground uppercase">Read-only audit history</p>
                  <DialogPrimitive.Title className="pt-[5px] text-subheading font-bold">Audit Event</DialogPrimitive.Title>
                  <p className="pt-[3px] font-mono text-title font-bold text-primary">{e.eventCode ?? e.id}</p>
                </div>
                <DialogPrimitive.Close render={<Button variant="outline" className="size-[42.5px] shrink-0 rounded-lg bg-card" aria-label="Close" />}>
                  <XIcon className="size-5" />
                </DialogPrimitive.Close>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-0 sm:px-[12.5px]">
                <div className="px-5 pt-[15px]">
                  <p className="flex items-center gap-2.5 rounded-lg bg-success-soft px-[15px] py-2.5 text-sm text-success">
                    <ShieldCheckIcon className="size-5 shrink-0" aria-hidden />
                    This event is immutable. It cannot be edited or deleted.
                  </p>
                </div>

                <Section title="Event Information">
                  <dl className="grid overflow-hidden rounded-lg border sm:grid-cols-2">
                    {[
                      ['Event ID', e.eventCode ?? e.id],
                      ['Date & Time', formatDateTime24(e.createdAt, { seconds: true })],
                      ['Actor', e.actor.name ?? e.actor.email ?? 'Unknown'],
                      ['Admin Role', e.actor.type === 'admin' ? 'Administrator' : '—'],
                      ['Actor Type', e.actor.type === 'admin' ? 'Admin' : 'Unrecognised account'],
                      ['Category', e.categoryLabel],
                      ['Action', e.actionLabel],
                      [
                        'Result',
                        <StatusBadge key="r" tone={e.result === 'success' ? 'success' : 'danger'} icon={false}>
                          {e.result === 'success' ? 'Success' : 'Failed'}
                        </StatusBadge>,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex min-h-[60px] flex-col justify-center gap-[3px] border-b border-divider px-[15px] py-2.5 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(2)]:border-b-0"
                      >
                        <dt className="text-caption text-muted-foreground">{label}</dt>
                        <dd className="text-sm font-semibold break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Section>

                {e.record && (
                  <Section title="Related Record" description="Open the existing source record without duplicating it.">
                    <Rows
                      rows={[
                        ['Record Type', e.record.typeLabel],
                        ['Record ID', e.record.ref ?? e.record.id],
                        ...(e.investor
                          ? [
                              ['Investor', e.investor.name],
                              ['User ID', e.investor.ref ?? '—'],
                            ]
                          : []),
                      ]}
                    />
                    {link && (
                      <Link
                        to={link}
                        onClick={onClose}
                        className="mt-[15px] flex h-[42.5px] items-center justify-center rounded-lg border bg-card text-sm font-bold transition-colors hover:bg-muted"
                      >
                        View Related Record
                      </Link>
                    )}
                  </Section>
                )}

                {e.changes.length > 0 && (
                  <Section title="Change Summary" description={e.changes.length === 1 ? e.changes[0].field : `${e.changes.length} fields changed`}>
                    <div className="space-y-2.5">
                      {e.changes.map((c) => (
                        <ChangeCard key={c.field} change={c} />
                      ))}
                    </div>
                  </Section>
                )}

                <Section title="Operational Context">
                  <Rows
                    rows={[
                      ...(e.description ? [['Details', e.description]] : []),
                      ...(e.error ? [['Error', <span className="text-destructive">{e.error}</span>]] : []),
                      ['Request', `${e.method} ${e.path} → ${e.statusCode}`],
                      ['IP Address', e.ip ?? '—'],
                      ['Device', e.userAgent ?? '—'],
                    ]}
                  />
                </Section>

                <Section title="Related Activity Timeline">
                  {!detail ? (
                    <Spinner className="size-5 text-muted-foreground" />
                  ) : !detail.timeline ? (
                    <p className="text-caption text-muted-foreground">Couldn’t load related activity.</p>
                  ) : (
                    <ol className="relative">
                      {detail.timeline.map((t, i) => (
                        <li key={t.id} className="grid grid-cols-[48px_10px_minmax(0,1fr)] items-start gap-2.5 pb-[15px] last:pb-0">
                          <time
                            dateTime={t.createdAt}
                            className="text-sm text-muted-foreground tabular-nums"
                            title={formatDateTime24(t.createdAt, { seconds: true })}
                          >
                            {formatTime24(t.createdAt)}
                          </time>
                          <span className="relative mt-1.5 flex justify-center">
                            <span className={cn('size-2.5 rounded-full', t.result === 'success' ? 'bg-primary' : 'bg-subtle')} />
                            {i < detail.timeline.length - 1 && <span className="absolute top-3.5 h-[calc(100%+12px)] w-px bg-border" aria-hidden />}
                          </span>
                          <p className={cn('text-sm', t.current && 'font-semibold')}>
                            {t.actionLabel}
                            {t.result === 'failure' && <span className="text-destructive"> (failed)</span>}
                            {t.actorName && <span className="font-normal text-muted-foreground"> · {t.actorName}</span>}
                            {t.current && <span className="font-normal text-muted-foreground"> · this event</span>}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </Section>
              </div>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
