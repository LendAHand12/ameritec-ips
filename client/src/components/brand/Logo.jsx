import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import logoMark from '@/assets/figma/logo-mark.svg'
import logoWordmark from '@/assets/figma/logo-wordmark.svg'
import logoIps from '@/assets/figma/logo-ips.svg'
import logoMarkLight from '@/assets/figma/logo-mark-light.svg'
import logoWordmarkLight from '@/assets/figma/logo-wordmark-light.svg'
import logoIpsLight from '@/assets/figma/logo-ips-light.svg'

const VARIANTS = {
  // Black wordmark for light backgrounds
  default: { mark: [logoMark, 33.845, 37.604], wordmark: [logoWordmark, 172.221, 24.003], ips: [logoIps, 50.258, 24.251], gap: 15 },
  // White wordmark for dark backgrounds (admin sidebar)
  light: { mark: [logoMarkLight, 29.253, 32.503], wordmark: [logoWordmarkLight, 148.857, 20.747], ips: [logoIpsLight, 43.44, 20.961], gap: 13 },
}

/** Ameritec IPS logo (mark + wordmark), assets exported from Figma. */
export default function Logo({ to = '/', variant = 'default', className }) {
  const { mark, wordmark, ips, gap } = VARIANTS[variant]
  return (
    <Link to={to} aria-label="Ameritec IPS home" className={cn('flex shrink-0 items-center', className)} style={{ gap }}>
      {/* The mark is exported upside-down in Figma and flipped back there */}
      <img src={mark[0]} alt="" width={mark[1]} height={mark[2]} className="-scale-y-100" />
      <span className="flex items-center" style={{ gap }}>
        <img src={wordmark[0]} alt="Ameritec" width={wordmark[1]} height={wordmark[2]} />
        <img src={ips[0]} alt="IPS" width={ips[1]} height={ips[2]} />
      </span>
    </Link>
  )
}
