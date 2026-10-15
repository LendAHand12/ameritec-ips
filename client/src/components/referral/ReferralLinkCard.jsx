import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Share2Icon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import CopyButton from '@/components/CopyButton'
import { Panel } from '@/components/dashboard/Panel'
import { buildReferralLink } from '@/lib/referral'

export default function ReferralLinkCard({ code }) {
  const link = buildReferralLink(code)
  const [qr, setQr] = useState('')

  useEffect(() => {
    QRCode.toDataURL(link, { width: 200, margin: 1, color: { dark: '#75150e' } }).then(setQr)
  }, [link])

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join Ameritec IPS', text: `Use my referral code ${code}`, url: link })
      } catch {
        // user closed the share sheet
      }
      return
    }
    await navigator.clipboard.writeText(link)
    toast.success('Referral link copied')
  }

  return (
    <Panel className="grid items-center gap-5 lg:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,2fr)_auto]">
      <div className="flex items-center gap-[13.75px]">
        <span className="flex size-[37.5px] shrink-0 items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
          <UsersIcon className="size-[21.25px]" />
        </span>
        <div>
          <h2 className="text-subheading font-bold">Your Referral Link</h2>
          <p className="pt-1 text-caption text-muted-foreground">Share your referral link to invite new participants.</p>
        </div>
      </div>

      <div>
        <p className="text-caption text-muted-foreground">Referral Code</p>
        <p className="pt-1 text-title font-bold tracking-wide">{code}</p>
      </div>

      <div className="min-w-0">
        <p className="text-caption text-muted-foreground">Referral URL</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <code className="flex h-10 min-w-0 flex-1 items-center truncate rounded-lg border bg-muted px-3 text-caption">{link}</code>
          <CopyButton value={link} label="Referral link" className="h-10 font-bold">
            Copy Link
          </CopyButton>
          <CopyButton value={code} label="Referral code" className="h-10 font-bold">
            Copy Code
          </CopyButton>
          <Button type="button" variant="outline" className="h-10 bg-card font-bold" onClick={share}>
            <Share2Icon />
            Share
          </Button>
        </div>
      </div>

      <figure className="flex flex-col items-center gap-1 justify-self-center">
        {qr && <img src={qr} alt="Referral link QR code" className="size-[70px] rounded-md" />}
        <figcaption className="text-caption text-subtle">Scan to join</figcaption>
      </figure>
    </Panel>
  )
}
