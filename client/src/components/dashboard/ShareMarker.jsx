import { cn } from '@/lib/utils'

const SHARE_COLOR = { A: 'var(--share-a)', B: 'var(--share-b)', ALL: 'var(--primary)' }

/** Ring used on the share KPI cards. */
export function ShareRing({ type }) {
  return <span aria-hidden className="size-[30px] rounded-full border-[9px] bg-card" style={{ borderColor: SHARE_COLOR[type] }} />
}

/** Small rounded square used in tables/legends. */
export function ShareSwatch({ type, className }) {
  return <span aria-hidden className={cn('inline-block size-[12.5px] shrink-0 rounded-[3.75px]', className)} style={{ background: SHARE_COLOR[type] }} />
}
