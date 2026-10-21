import { useMemo, useState } from 'react'
import { ChevronRightIcon, SearchIcon } from 'lucide-react'
import FilterSelect from '@/components/admin/FilterSelect'
import Pagination from '@/components/admin/Pagination'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import SegmentedControl from '@/components/dashboard/SegmentedControl'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { formatDateTime24 } from '@/lib/format'
import { cn } from '@/lib/utils'

const VIEW_OPTIONS = [
  { value: 'tree', label: 'Tree View' },
  { value: 'list', label: 'List View' },
]
const LEVEL_OPTIONS = [1, 2, 3].map((l) => ({ value: String(l), label: `F${l}` }))
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]
const PAGE_SIZE = 10

const initials = (name = '') =>
  name
    .replace('.', '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

function Avatar({ name, dark }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-caption font-bold',
        dark ? 'bg-white/15 text-white' : 'bg-primary-soft text-foreground',
      )}
    >
      {initials(name)}
    </span>
  )
}

function MemberCard({ member, expandable, expanded, onToggle }) {
  return (
    <div className="flex w-full max-w-[340px] items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${member.name}`}
          className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        >
          <ChevronRightIcon className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <Avatar name={member.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption font-bold">{member.name}</p>
        <p className="truncate text-caption text-muted-foreground">
          F{member.level} · Joined {formatDateTime24(member.joinedAt)}
        </p>
      </div>
      <StatusBadge tone={member.active ? 'success' : 'neutral'} icon={false} className="h-6 px-2">
        {member.active ? 'Active' : 'Inactive'}
      </StatusBadge>
    </div>
  )
}

function TreeBranch({ nodes, childrenOf, expanded, toggle, forceOpen }) {
  return (
    <ul className="ml-[13px] space-y-2.5 border-l border-border pt-2.5 pl-5">
      {nodes.map((m) => {
        const kids = childrenOf(m.id)
        const open = forceOpen || expanded.has(m.id)
        return (
          <li key={m.id} className="relative">
            <span aria-hidden className="absolute top-[26px] -left-5 h-px w-5 bg-border" />
            <MemberCard member={m} expandable={kids.length > 0} expanded={open} onToggle={() => toggle(m.id)} />
            {open && kids.length > 0 && <TreeBranch nodes={kids} childrenOf={childrenOf} expanded={expanded} toggle={toggle} forceOpen={forceOpen} />}
          </li>
        )
      })}
    </ul>
  )
}

export default function ReferralNetwork({ rootName, members }) {
  const [view, setView] = useState('tree')
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  // F1 branches start open, like the design
  const [expanded, setExpanded] = useState(() => new Set(members.filter((m) => m.level === 1).map((m) => m.id)))

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const filtering = !!(search.trim() || level || status)
  const matches = (m) =>
    (!search.trim() || m.name.toLowerCase().includes(search.trim().toLowerCase())) &&
    (!level || m.level === Number(level)) &&
    (!status || (status === 'active') === m.active)

  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])
  const filtered = useMemo(() => members.filter(matches), [members, search, level, status]) // eslint-disable-line react-hooks/exhaustive-deps

  // In tree view a filter keeps matching members plus their ancestors, so the path stays visible
  const visibleIds = useMemo(() => {
    if (!filtering) return null
    const ids = new Set()
    for (const m of filtered) {
      let node = m
      while (node) {
        ids.add(node.id)
        node = byId[node.parentId]
      }
    }
    return ids
  }, [filtering, filtered, byId])

  const childrenOf = (parentId) => members.filter((m) => m.parentId === parentId && (!visibleIds || visibleIds.has(m.id)))
  const roots = members.filter((m) => m.level === 1 && (!visibleIds || visibleIds.has(m.id)))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const setFilter = (setter) => (v) => {
    setter(v)
    setPage(1)
  }

  return (
    <Panel className="px-0 pb-5">
      <PanelHeader
        className="px-[25px]"
        title="Referral Network"
        description="Everyone who joined through you, down to F3."
        action={<SegmentedControl label="View" options={VIEW_OPTIONS} value={view} onChange={setView} />}
      />

      <div className="mt-5 flex flex-wrap gap-2.5 border-y border-divider bg-muted px-[25px] py-[12.5px]">
        <label className="flex h-[42.5px] w-full items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30 sm:w-[260px]">
          <SearchIcon className="size-5 shrink-0 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setFilter(setSearch)(e.target.value)}
            placeholder="Search member"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
            aria-label="Search member"
          />
        </label>
        <div className="grid flex-1 grid-cols-2 gap-2.5 sm:max-w-[320px]">
          <FilterSelect label="Level" allLabel="All Levels" options={LEVEL_OPTIONS} value={level} onChange={setFilter(setLevel)} />
          <FilterSelect label="Status" allLabel="All Statuses" options={STATUS_OPTIONS} value={status} onChange={setFilter(setStatus)} />
        </div>
      </div>

      <div className="px-[25px] pt-5">
        {view === 'tree' ? (
          <div className="overflow-x-auto pb-1">
            <div className="flex w-fit items-center gap-2.5 rounded-lg bg-brand-muted px-3 py-2.5 pr-8 text-white shadow-md">
              <Avatar name={rootName} dark />
              <div>
                <p className="text-caption font-bold">{rootName}</p>
                <p className="text-caption text-white/70">You · Network root</p>
              </div>
            </div>
            {roots.length ? (
              <TreeBranch nodes={roots} childrenOf={childrenOf} expanded={expanded} toggle={toggle} forceOpen={filtering} />
            ) : (
              <p className="py-8 text-caption text-muted-foreground">
                {filtering ? 'No members match your filters.' : 'No one has joined with your referral link yet. Share it to grow your network.'}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-caption">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="border-b border-divider py-2.5 font-semibold">Member</th>
                    <th className="border-b border-divider py-2.5 font-semibold">Level</th>
                    <th className="border-b border-divider py-2.5 font-semibold">Referred by</th>
                    <th className="border-b border-divider py-2.5 font-semibold">Joined</th>
                    <th className="border-b border-divider py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((m) => (
                    <tr key={m.id}>
                      <td className="border-b border-divider py-2.5">
                        <span className="flex items-center gap-2.5 font-semibold">
                          <Avatar name={m.name} />
                          {m.name}
                        </span>
                      </td>
                      <td className="border-b border-divider py-2.5">
                        <span className="inline-flex h-[27.5px] min-w-[35px] items-center justify-center rounded-[6.25px] bg-primary-soft px-2 font-bold text-primary">
                          F{m.level}
                        </span>
                      </td>
                      <td className="border-b border-divider py-2.5 text-muted-foreground">{byId[m.parentId]?.name ?? 'You'}</td>
                      <td className="border-b border-divider py-2.5 text-muted-foreground">{formatDateTime24(m.joinedAt)}</td>
                      <td className="border-b border-divider py-2.5">
                        <StatusBadge tone={m.active ? 'success' : 'neutral'} icon={false}>
                          {m.active ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && <p className="py-8 text-center text-caption text-muted-foreground">No members match your filters.</p>}
            <div className="flex items-center justify-between pt-4">
              <p className="text-caption text-muted-foreground">{filtered.length} members</p>
              <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}
