import { useMatches } from 'react-router-dom'
import ComingSoon from '@/components/ComingSoon'

export default function AdminPlaceholderPage() {
  const title = useMatches().at(-1)?.handle?.title ?? 'Admin'
  return (
    <>
      <h1 className="mb-6 text-[26px] leading-tight font-bold tracking-[-0.01em] sm:text-heading">{title}</h1>
      <ComingSoon />
    </>
  )
}
