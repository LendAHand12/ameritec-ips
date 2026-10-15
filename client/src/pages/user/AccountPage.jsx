import ComingSoon from '@/components/ComingSoon'
import PageHeader from '@/components/PageHeader'

export default function AccountPage() {
  return (
    <>
      <PageHeader breadcrumb={['Investor Portal', 'Account & Security']} title="Account & Security" />
      <ComingSoon />
    </>
  )
}
