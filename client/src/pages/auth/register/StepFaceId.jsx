import { ScanFaceIcon } from 'lucide-react'
import StepActions from './StepActions'

// TODO: integrate FaceTec face enrollment
export default function StepFaceId({ onBack, onNext }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
        <ScanFaceIcon className="size-10 text-muted-foreground" />
        <div className="font-medium">Face ID enrollment</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Face verification is coming soon. You can continue with the registration for now.
        </p>
      </div>
      <StepActions onBack={onBack} onNext={() => onNext({ completed: false })} />
    </div>
  )
}
