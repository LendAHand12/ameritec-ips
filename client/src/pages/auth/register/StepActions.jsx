import { ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export default function StepActions({ onBack, backLabel = 'Back', nextLabel = 'Continue', nextDisabled, loading, onNext, nextType = 'button' }) {
  return (
    <div className={cn('grid gap-[11.25px] pt-[25px]', onBack && 'sm:grid-cols-[2fr_3fr]')}>
      <Button
        type={nextType}
        size="xl"
        className="w-full sm:order-last"
        onClick={onNext}
        disabled={nextDisabled || loading}
      >
        {nextLabel}
        {loading ? <Spinner className="size-5" /> : <ArrowRightIcon />}
      </Button>
      {onBack && (
        <Button type="button" variant="outline" size="xl" className="w-full bg-card" onClick={onBack} disabled={loading}>
          {backLabel}
        </Button>
      )}
    </div>
  )
}
