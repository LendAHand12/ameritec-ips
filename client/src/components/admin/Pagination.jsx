import { cn } from '@/lib/utils'

function pageWindow(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…' + p)
    out.push(p)
  })
  return out
}

const btn = 'flex size-[33.75px] items-center justify-center rounded-[6.25px] border bg-card text-caption text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40'

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="flex gap-[5px]">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        ‹
      </button>
      {pageWindow(page, totalPages).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="flex w-6 items-end justify-center text-caption text-subtle">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page && 'border-brand-muted bg-brand-muted text-white hover:bg-brand-muted')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
        ›
      </button>
    </nav>
  )
}
