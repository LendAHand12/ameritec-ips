/** a••••@example.com */
export function maskEmail(email = '') {
  const [local, domain] = email.split('@')
  if (!domain) return '••••'
  return `${local[0] ?? ''}••••@${domain}`
}

/** •••• ••• 284 */
export function maskPhone(phone = '') {
  return phone ? `•••• ••• ${phone.slice(-3)}` : ''
}
