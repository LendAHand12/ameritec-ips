/** Admin KPI card: uppercase label over a large number. Clickable when `onClick` is given. */
export default function StatCard({ label, value, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-lg border bg-card px-[17.5px] py-[15px] text-left shadow-[0_1.25px_1.25px_rgb(0_0_0/0.04)] ${onClick ? 'transition-colors hover:border-primary/50' : ''}`}
    >
      <span className="block text-caption font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="block pt-[5px] text-subheading font-bold tabular-nums">{value ?? '—'}</span>
    </Tag>
  )
}
