import { ConstructionIcon } from 'lucide-react'

export default function ComingSoon({ children = 'This page is under construction.' }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
      <ConstructionIcon className="size-8" />
      {children}
    </div>
  )
}
