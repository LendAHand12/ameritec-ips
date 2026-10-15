import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function CopyButton({ value, label = 'Copy', className, children }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed — select and copy manually')
    }
  }
  return (
    <Button type="button" variant="outline" onClick={copy} aria-label={children ? undefined : `Copy ${label}`} className={cn('bg-card', className)}>
      {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      {children}
    </Button>
  )
}
