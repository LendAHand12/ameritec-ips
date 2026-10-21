import { useState } from 'react'
import { CheckIcon, ShieldCheckIcon } from 'lucide-react'
import DocumentUpload from '@/components/auth/DocumentUpload'
import SelfieSample, { SELFIE_SAMPLE_SRC } from '@/components/auth/SelfieSample'
import { cn } from '@/lib/utils'
import { DOCUMENT_TYPES } from './constants'
import StepActions from './StepActions'

const PHOTO_GUIDANCE = [
  'Make sure all information is visible',
  'Avoid glare',
  'Do not crop the document',
  'Use a clear, well-lit image',
]

function DocumentTypePicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-labelledby="document-type-label" className="grid gap-2.5 sm:grid-cols-3">
      {DOCUMENT_TYPES.map((doc) => {
        const selected = doc.value === value
        return (
          <button
            key={doc.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(doc.value)}
            className={cn(
              'flex min-h-[50px] items-center gap-2.5 rounded-lg border px-[12.5px] text-left text-caption transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
              selected ? 'border-primary bg-primary-soft text-foreground' : 'bg-card text-muted-foreground hover:border-primary/50',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border',
                selected && 'border-primary bg-primary text-primary-foreground',
              )}
            >
              {selected && <CheckIcon className="size-[16.25px]" />}
            </span>
            {doc.label}
          </button>
        )
      })}
    </div>
  )
}

export default function StepIdentity({ value, serverErrors, onBack, onNext }) {
  const [identity, setIdentity] = useState(value)
  const [errors, setErrors] = useState(serverErrors ?? {})

  const setFile = (key, file) => {
    setIdentity((prev) => ({ ...prev, [key]: file }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }
  const setFileError = (key) => (message) => setErrors((prev) => ({ ...prev, [key]: message }))

  const handleNext = () => {
    const next = {}
    if (!identity.front) next.front = 'Please upload the front of your document'
    if (!identity.back) next.back = 'Please upload the back of your document'
    if (!identity.supporting) next.supporting = 'Please upload a photo of yourself holding your document'
    setErrors(next)
    if (!Object.keys(next).length) onNext(identity)
  }

  return (
    <div>
      <div className="flex items-start gap-[12.5px] rounded-lg bg-success-soft p-[15px]">
        <ShieldCheckIcon className="size-[25px] shrink-0 text-success" />
        <div className="space-y-[5px] text-caption">
          <p className="font-bold">Your information is protected</p>
          <p className="text-muted-foreground">
            Your documents are used only for identity verification and are not displayed in your account summary.
          </p>
        </div>
      </div>

      <div className="pt-[25px]">
        <div className="flex min-h-[21.25px] items-start justify-between">
          <span id="document-type-label" className="text-caption font-semibold">Document type</span>
          <span className="text-caption font-semibold text-primary">Required</span>
        </div>
        <DocumentTypePicker
          value={identity.documentType}
          // Different document → previous photos no longer apply
          onChange={(documentType) => {
            if (documentType === identity.documentType) return
            setIdentity((prev) => ({ ...prev, documentType, front: null, back: null, supporting: null }))
            setErrors({})
          }}
        />
      </div>

      {/* The three photos side by side, each with an example of what to upload */}
      <div className="grid gap-6 pt-5 md:grid-cols-3 md:gap-8">
        <DocumentUpload
          label="Document Front"
          required
          placeholderImage="/kyc-sample-front.svg"
          file={identity.front}
          error={errors.front}
          onChange={(file) => setFile('front', file)}
          onError={setFileError('front')}
        />
        <DocumentUpload
          label="Document Back"
          required
          placeholderImage="/kyc-sample-back.svg"
          file={identity.back}
          error={errors.back}
          onChange={(file) => setFile('back', file)}
          onError={setFileError('back')}
        />
        <DocumentUpload
          label="You Holding Your Document"
          uploadLabel="Upload your photo with the document"
          required
          placeholderImage={SELFIE_SAMPLE_SRC}
          file={identity.supporting}
          error={errors.supporting}
          onChange={(file) => setFile('supporting', file)}
          onError={setFileError('supporting')}
        />
      </div>

      <div className="mt-[17.5px] rounded-lg bg-muted px-[16.25px] py-[13.75px]">
        <p className="text-caption font-bold">Photo guidance</p>
        <ul className="mt-[8.75px] grid gap-[7.5px] sm:grid-cols-2">
          {PHOTO_GUIDANCE.map((tip) => (
            <li key={tip} className="flex items-center gap-[6.25px] text-caption text-muted-foreground">
              <CheckIcon className="size-[16.25px] shrink-0 text-success" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-[21.25px] border-t pt-[21.25px]">
        <p className="pb-3 text-caption text-muted-foreground">
          All 3 photos are required: the front and back of your document, and a photo of you holding that same document. Your account can’t be approved until all 3 are submitted.
        </p>
        <SelfieSample showImage={false} />
      </div>

      <StepActions onBack={() => onBack(identity)} onNext={handleNext} nextLabel="Continue to Secure Account" />
    </div>
  )
}
