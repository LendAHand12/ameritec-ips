const usdt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const longDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
const mediumDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

// Shares can be fractional (10 USDT at 4 USDT/share = 2.5): show up to 3 decimals, no trailing zeros
const shareFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
export const formatShares = (n) => shareFmt.format(n ?? 0)

/** Mirrors the server: shares for `amountCents` at `priceCents`, rounded at the 4th decimal digit (3 kept). */
export const sharesFor = (amountCents, priceCents) => Math.round((amountCents * 1000) / priceCents) / 1000
export const MIN_SHARES = 0.001
export const roundShares = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000

export const formatUsdt = (n) => usdt.format(n)
export const formatInt = (n) => integer.format(n)
export const formatCompact = (n) => compact.format(n)
export const formatShortDate = (d) => shortDate.format(new Date(d))
export const formatDate = (d) => longDate.format(new Date(d))
/** "Oct 2, 2026 · 10:24 AM" */
export const formatDateTime = (d) => `${mediumDate.format(new Date(d))} · ${time.format(new Date(d))}`
/** Per-class commission rates, e.g. "8%" when equal or "Class A 8% · Class B 10%". */
export const formatClassRates = (rates) => (rates.A === rates.B ? `${rates.A}%` : `Class A ${rates.A}% · Class B ${rates.B}%`)
const dateTime24 = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
const dateTime24s = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
/** "Oct 2, 2026 · 04:42" (or "· 04:42:18" with seconds) */
export const formatDateTime24 = (d, { seconds = false } = {}) =>
  `${mediumDate.format(new Date(d))} · ${(seconds ? dateTime24s : dateTime24).format(new Date(d))}`
export const formatTime24 = (d) => dateTime24.format(new Date(d))

/** Human duration: "18 min", "3.2 hrs", "2.5 days". */
export function formatDuration(ms) {
  if (ms == null) return '—'
  const minutes = ms / 60_000
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`
  const hours = minutes / 60
  if (hours < 48) return `${hours.toFixed(1)} hrs`
  return `${(hours / 24).toFixed(1)} days`
}

export const formatPercent = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
