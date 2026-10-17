import { PencilIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { COUNTRY_BY_ISO } from '@/lib/countries'
import { DOCUMENT_LABEL, STEP_INDEX } from './constants'
import StepActions from './StepActions'

function Section({ title, onEdit, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <PencilIcon />
            Edit
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Thumb({ file, label }) {
  const url = useObjectUrl(file)
  return (
    <figure className="space-y-1">
      {url && <img src={url} alt={label} className="aspect-[3/2] w-full rounded-md border object-cover" />}
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  )
}

export default function StepReview({ data, onEdit, onBack, onSubmit, submitting }) {
  const { account, referrer, identity, twoFactor } = data
  const country = COUNTRY_BY_ISO[account.phoneCountry]

  return (
    <div className="flex flex-col gap-6">
      <Section title="Account information" onEdit={() => onEdit(STEP_INDEX.account)}>
        <dl className="space-y-2">
          <Row label="Full name">{account.fullName}</Row>
          <Row label="Email">{account.email}</Row>
          <Row label="Phone number">
            {country?.flag} +{country?.dialCode} {account.phoneNumber}
          </Row>
          <Row label="Referral code">
            {account.referralCode ? (
              <>
                {account.referralCode}
                {referrer && <span className="text-muted-foreground"> · {referrer.fullName}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </Row>
        </dl>
      </Section>

      <Separator />

      <Section title="Identity verification" onEdit={() => onEdit(STEP_INDEX.identity)}>
        <dl className="space-y-2">
          <Row label="Document">{DOCUMENT_LABEL[identity.documentType]}</Row>
        </dl>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Thumb file={identity.front} label="Document front" />
          <Thumb file={identity.back} label="Document back" />
          {identity.supporting && <Thumb file={identity.supporting} label="Supporting certificate" />}
        </div>
      </Section>

      <Separator />

      <Section title="Security">
        <dl className="space-y-2">
          <Row label="Face ID">
            <Badge variant="secondary">After approval</Badge>
          </Row>
          <Row label="Two-factor auth">
            <Badge variant={twoFactor ? 'default' : 'secondary'}>{twoFactor ? 'Enabled' : 'Skipped — optional'}</Badge>
          </Row>
        </dl>
      </Section>

      <StepActions onBack={onBack} nextLabel="Submit registration" onNext={onSubmit} loading={submitting} />
    </div>
  )
}
