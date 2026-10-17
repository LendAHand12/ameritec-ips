import { useMemo, useState } from 'react'
import { ChevronDownIcon, MailWarningIcon, NetworkIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import Pagination from '@/components/admin/Pagination'
import SegmentedControl from '@/components/dashboard/SegmentedControl'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { KYC_STATUS } from '@/lib/adminUsers'
import { formatDate, formatInt, formatUsdt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getUserNetwork } from '@/services/admin.service'

const PAGE_SIZE = 8
const FACE = {
  approved: { label: 'Face ✓', tone: 'success' },
  pending: { label: 'Face to review', tone: 'warning' },
  rejected: { label: 'Face rejected', tone: 'danger' },
  none: { label: 'No face scan', tone: 'neutral' },
}

function Body({ userId, onOpenUser }) {
  const { data } = useAsync(() => getUserNetwork(userId).then((r) => r.data), [userId])
  const [level, setLevel] = useState('all')
  const [page, setPage] = useState(1)

  const byId = useMemo(() => Object.fromEntries((data?.members ?? []).map((m) => [m.id, m])), [data])
  const rows = useMemo(() => (data?.members ?? []).filter((m) => level === 'all' || m.level === Number(level)), [data, level])

  if (!data) return <Spinner className="mx-auto my-6 size-5 text-muted-foreground" />
  const { summary } = data
  if (!summary.total) return <p className="px-3.5 py-5 text-center text-caption text-muted-foreground">Nobody has joined through {data.root.fullName} yet.</p>

  const options = [
    { value: 'all', label: `All ${summary.total}` },
    ...summary.levels.map((n, i) => ({ value: String(i + 1), label: `F${i + 1} · ${n}` })),
  ]
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-3 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Network level"
          options={options}
          value={level}
          onChange={(v) => {
            setLevel(v)
            setPage(1)
          }}
        />
        <p className="text-caption text-muted-foreground">
          <span className="font-semibold text-foreground">{formatInt(summary.buyers)}</span> bought · {formatUsdt(summary.purchased)} USDT purchased
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] border-collapse text-caption">
          <thead>
            <tr className="bg-muted text-left text-muted-foreground">
              <th className="px-2.5 py-2 font-semibold">Member</th>
              <th className="px-2.5 py-2 font-semibold">Level</th>
              <th className="px-2.5 py-2 font-semibold">Status</th>
              <th className="px-2.5 py-2 font-semibold">Purchased</th>
              <th className="px-2.5 py-2 font-semibold">Commission to this user</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((m) => {
              const kyc = KYC_STATUS[m.kycStatus]
              const face = FACE[m.faceStatus]
              return (
                <tr key={m.id} className="border-t border-divider">
                  <td className="px-2.5 py-2">
                    <button type="button" onClick={() => onOpenUser(m.id)} className="text-left text-sm font-semibold hover:text-primary hover:underline">
                      {m.fullName}
                    </button>
                    <p className="text-muted-foreground">
                      {m.referralCode} · joined {formatDate(m.joinedAt)}
                      {m.level > 1 && byId[m.parentId] && <> · via {byId[m.parentId].fullName}</>}
                    </p>
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md bg-primary-soft px-1.5 font-bold text-primary">F{m.level}</span>
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex flex-wrap gap-1">
                      {m.emailVerified ? (
                        <StatusBadge tone={kyc.tone} icon={false} className="h-6">
                          {kyc.label}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="danger" icon={false} className="h-6">
                          <MailWarningIcon className="size-3.5" />
                          Email not verified
                        </StatusBadge>
                      )}
                      <StatusBadge tone={face.tone} icon={false} className="h-6">
                        {face.label}
                      </StatusBadge>
                      {m.accountStatus === 'locked' && (
                        <StatusBadge tone="danger" icon={false} className="h-6">
                          Locked
                        </StatusBadge>
                      )}
                    </div>
                  </td>
                  <td className="px-2.5 py-2 tabular-nums">
                    {m.purchases ? (
                      <>
                        <span className="font-semibold">{formatUsdt(m.purchased)} USDT</span>
                        <p className="text-muted-foreground">
                          {m.purchases} order{m.purchases > 1 ? 's' : ''}
                        </p>
                      </>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 tabular-nums">
                    {m.commission ? (
                      m.commission.available + m.commission.pending > 0 ? (
                        <>
                          <span className="font-semibold text-success">{formatUsdt(m.commission.available)}</span>
                          {m.commission.pending > 0 && <span className="font-semibold text-warning"> + {formatUsdt(m.commission.pending)} pending</span>}
                        </>
                      ) : (
                        <span className="text-subtle">0.00</span>
                      )
                    ) : (
                      <span className="text-subtle" title="Commission is paid on direct referrals (F1) only">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-caption text-muted-foreground">
          {rows.length} member{rows.length === 1 ? '' : 's'}
          {summary.truncated && ' (list capped)'} · click a name to open their profile
        </p>
        <Pagination page={page} totalPages={Math.ceil(rows.length / PAGE_SIZE)} onChange={setPage} />
      </div>
    </div>
  )
}

/** "Referral network" block of the admin user profile: the user's F1–F3 downline, loaded when opened. */
export default function UserNetwork({ userId, onOpenUser }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-muted/50 px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <NetworkIcon className="size-4" />
          Referral network
          <span className="text-caption font-normal text-muted-foreground">F1 – F3 downline</span>
        </span>
        <ChevronDownIcon className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <Body userId={userId} onOpenUser={onOpenUser} />}
    </section>
  )
}
