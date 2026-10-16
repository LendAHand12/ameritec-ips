import { useState } from 'react'
import { InfoIcon } from 'lucide-react'
import FaceCapture from '@/components/account/FaceCapture'
import StepActions from './StepActions'

/** Optional: take the face scan now, or skip and add it later from Account & Security. */
export default function StepFaceId({ value, onBack, onNext }) {
  const [file, setFile] = useState(value?.file ?? null)

  return (
    <div className="flex flex-col gap-5">
      <FaceCapture value={file} onChange={setFile} />

      <div className="flex items-start gap-2.5 rounded-lg bg-muted p-3.5 text-caption text-muted-foreground">
        <InfoIcon className="mt-px size-4 shrink-0" />
        <p>
          This step is <span className="font-semibold text-foreground">optional</span>. You can buy shares without it, but the commission your referrer earns from your
          purchases is only released once you add a face scan and our team approves it.
        </p>
      </div>

      <StepActions onBack={onBack} nextLabel="Continue" nextDisabled={!file} onNext={() => onNext({ file })} />
      <button
        type="button"
        onClick={() => onNext(null)}
        className="-mt-2 self-center text-title font-semibold text-primary hover:underline"
      >
        Skip for now — I’ll do this later
      </button>
    </div>
  )
}
