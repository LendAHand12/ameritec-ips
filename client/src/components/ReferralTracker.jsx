import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { REFERRAL_PARAM, storeReferralCode } from '@/lib/referral'

/** Remembers the referral code from any page visited through a referral link (?ref=CODE). */
export default function ReferralTracker() {
  const [searchParams] = useSearchParams()
  const ref = searchParams.get(REFERRAL_PARAM)

  useEffect(() => {
    if (ref) storeReferralCode(ref)
  }, [ref])

  return null
}
