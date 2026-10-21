import { CheckIcon } from 'lucide-react'

const SELFIE_TIPS = [
  'Hold your document next to your face',
  'Your face and the whole document must be in the frame',
  'The text on the document must be readable',
  'No glasses, hats or filters, and no glare',
]

/** What the photo of the person holding their document should look like. */
export const SELFIE_SAMPLE_SRC = '/kyc-selfie-sample.svg'

/** `showImage={false}` when the example picture is already shown inside the upload box. */
export default function SelfieSample({ className, showImage = true }) {
  return (
    <div className={className}>
      {showImage && <img src={SELFIE_SAMPLE_SRC} alt="Example: a person holding their ID card next to their face" className="w-full rounded-lg border" />}
      <p className={showImage ? 'pt-3 text-caption font-bold' : 'text-caption font-bold'}>How your photo should look</p>
      <ul className="mt-2 space-y-1.5">
        {SELFIE_TIPS.map((tip) => (
          <li key={tip} className="flex items-start gap-1.5 text-caption text-muted-foreground">
            <CheckIcon className="mt-px size-4 shrink-0 text-success" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  )
}
