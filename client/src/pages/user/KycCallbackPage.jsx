import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2Icon, ScanFaceIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import PageHeader from '@/components/PageHeader'
import { Panel } from '@/components/dashboard/Panel'
import { useAuth } from '@/hooks/useAuth'
import { completeFaceScan } from '@/services/kyc.service'

const BACK_TO = '/account?tab=identity'

/**
 * Where the FaceTec host sends the browser back to:
 *   /user/kyc-callback?token=<JWT>&facetect_tid=<TID>&status=success&age_estimate=<n>
 * We forward the result to the server (which checks the token and the signed-in user), refresh the
 * profile and return to Account & Security.
 */
export default function KycCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [state, setState] = useState({ phase: 'working', message: '' })
  // React runs effects twice in dev; the link is single use, so only ever submit once
  const submitted = useRef(false)

  useEffect(() => {
    if (submitted.current) return
    submitted.current = true
    const token = params.get('token')
    if (!token) return setState({ phase: 'error', message: 'This page is missing its face scan token. Please start the scan again.' })

    completeFaceScan({
      token,
      facetecTid: params.get('facetect_tid') ?? '',
      status: params.get('status') ?? '',
      ageEstimate: params.get('age_estimate') ?? '',
    })
      .then(async ({ status }) => {
        await refresh() // sync the profile so the new face scan status shows everywhere
        setState({ phase: 'done', message: status === 'approved' ? 'Your face scan is verified.' : 'Your face scan was received and is waiting for review.' })
        toast.success('Face scan submitted')
        setTimeout(() => navigate(BACK_TO, { replace: true }), 1800)
      })
      .catch((err) => setState({ phase: 'error', message: err.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageHeader breadcrumb={['Investor Portal', 'Account & Security', 'Face scan']} title="Face scan" />
      <Panel className="mx-auto max-w-[560px] py-10 text-center">
        {state.phase === 'working' && (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Spinner className="size-7" />
            </span>
            <h2 className="mt-4 text-subheading font-bold">Finishing your face scan…</h2>
            <p className="mt-1.5 text-caption text-muted-foreground">Please don’t close this page.</p>
          </>
        )}
        {state.phase === 'done' && (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2Icon className="size-8" />
            </span>
            <h2 className="mt-4 text-subheading font-bold">Face scan complete</h2>
            <p className="mt-1.5 text-caption text-muted-foreground">{state.message} Taking you back…</p>
            <Link to={BACK_TO} replace className={buttonVariants({ variant: 'outline', className: 'mt-5 bg-card' })}>
              Back to Account & Security
            </Link>
          </>
        )}
        {state.phase === 'error' && (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger">
              <XCircleIcon className="size-8" />
            </span>
            <h2 className="mt-4 text-subheading font-bold">We couldn’t finish your face scan</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-caption text-muted-foreground">{state.message}</p>
            <Button className="mt-5" onClick={() => navigate(BACK_TO, { replace: true })}>
              <ScanFaceIcon />
              Back to Account & Security
            </Button>
          </>
        )}
      </Panel>
    </>
  )
}
