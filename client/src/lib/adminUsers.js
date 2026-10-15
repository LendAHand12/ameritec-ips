export const KYC_STATUS = {
  pending: { label: 'Pending Review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const ACCOUNT_STATUS = {
  active: { label: 'Active', tone: 'success' },
  locked: { label: 'Locked', tone: 'danger' },
}

export const DATE_RANGES = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
]

export const DOCUMENT_TYPE_LABEL = {
  national_id: 'National ID',
  passport: 'Passport',
  drivers_license: 'Driver’s License',
}
