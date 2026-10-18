export const ORDER_STATUS = {
  awaiting_payment: { label: 'Awaiting Payment', tone: 'neutral' },
  paying: { label: 'Paying', tone: 'warning' },
  verifying: { label: 'Verifying', tone: 'warning' },
  pending_review: { label: 'Pending Review', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const PAYMENT_METHOD_LABEL = { bep20: 'USDT (BEP20)', zelle: 'Zelle', other: 'Other' }

export const bscscanTxUrl = (hash) => `https://bscscan.com/tx/${hash}`
