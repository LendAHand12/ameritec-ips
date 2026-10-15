import { TrendingUpIcon } from 'lucide-react'
import { formatUsdt } from '@/lib/format'

function Stat({ label, value, unit }) {
  return (
    <div className="flex flex-col gap-[7.5px] border-white/12 sm:border-l sm:pl-[27.5px]">
      <p className="text-caption text-steel">{label}</p>
      <p className="whitespace-nowrap text-white">
        <span className="text-subheading font-semibold tabular-nums">{value}</span>{' '}
        <span className="text-caption font-medium text-steel">{unit}</span>
      </p>
    </div>
  )
}

export default function PreIpoInfoBar({ shares, balance }) {
  return (
    <section
      aria-label="Pre-IPO information"
      className="grid gap-5 rounded-xl bg-brand-muted px-[25px] py-[17.5px] shadow-[0_7.5px_11.25px_rgb(0_0_0/0.1)] sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:items-center"
    >
      <div className="flex items-center gap-[15px]">
        <span className="flex size-[42.5px] items-center justify-center rounded-lg border border-white/16 bg-white/8 text-white">
          <TrendingUpIcon className="size-[25px]" />
        </span>
        <div className="space-y-[5px]">
          <p className="text-title font-bold text-white">Pre-IPO information</p>
          <p className="text-caption text-steel">Current offering prices</p>
        </div>
      </div>
      {shares.map((s) => (
        <Stat key={s.type} label={`${s.label} Price`} value={formatUsdt(s.price)} unit="USDT / Share" />
      ))}
      <Stat label="Commission Balance" value={formatUsdt(balance)} unit="USDT" />
    </section>
  )
}
