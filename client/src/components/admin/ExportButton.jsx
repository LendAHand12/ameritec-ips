import { ArrowDownToLineIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/** The "Export Excel" button every admin list uses, so they all look and read the same. `count` = selected rows. */
export default function ExportButton({ onClick, loading, count = 0 }) {
  return (
    <Button className="h-[50px] min-w-[150px] gap-3 px-[21.25px] text-title font-bold" onClick={onClick} disabled={loading}>
      {count ? `Export Excel (${count})` : 'Export Excel'}
      {loading ? <Spinner className="size-5" /> : <ArrowDownToLineIcon className="size-[22.5px]" />}
    </Button>
  )
}
