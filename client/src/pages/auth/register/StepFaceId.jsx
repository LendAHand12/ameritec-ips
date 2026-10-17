import { ScanFaceIcon } from 'lucide-react'
import StepActions from './StepActions'

/** The face scan itself happens after sign-in (it needs your account), so here we only explain it. */
export default function StepFaceId({ onBack, onNext }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <ScanFaceIcon className="size-8" />
        </span>
        <h3 className="text-title font-bold">You’ll scan your face after your account is approved</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Once you can sign in, open <span className="font-semibold text-foreground">Account &amp; Security → Identity Verification</span> and start the secure face scan.
          It’s optional and you can buy shares without it — but the commission your referrer earns from your purchases is only released once your face scan is approved.
        </p>
      </div>
      <StepActions onBack={onBack} onNext={() => onNext(null)} />
    </div>
  )
}
