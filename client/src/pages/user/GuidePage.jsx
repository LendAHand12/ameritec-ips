import ComingSoon from '@/components/ComingSoon'
import PageHeader from '@/components/PageHeader'

export default function GuidePage() {
  return (
    <>
      <PageHeader breadcrumb={['Investor Portal', 'Guide']} title="Guide" />
      <ComingSoon />
    </>
  )
}
