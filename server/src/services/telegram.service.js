import env from '../config/env.js'

const esc = (s) => String(s ?? '—').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

/** Posts a message to the admins' Telegram chat. Best effort: never throws, does nothing when not configured. */
export async function notifyAdminsTelegram(text) {
  const { botToken, chatId } = env.telegram
  if (!botToken || !chatId) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    return true
  } catch (err) {
    console.error('Telegram notification failed:', err.message)
    return false
  }
}

const REVIEW_URL = () => `${env.clientUrl}/admin/transactions?status=pending_review`

/** A face scan was submitted and needs an admin to approve it. */
export function notifyFaceSubmitted(user) {
  return notifyAdminsTelegram(
    ['🧑 <b>Face scan to review</b>', `User: ${esc(user?.fullName)} (${esc(user?.email)})`, `Review: ${env.clientUrl}/admin/users`].join('\n'),
  )
}

/** A user asked to withdraw commission: an admin has to send the USDT and mark it paid. */
export function notifyWithdrawalRequested(withdrawal, user) {
  const lines = [
    '🏦 <b>Commission withdrawal requested</b>',
    `Request: <b>${esc(withdrawal.code)}</b>`,
    `User: ${esc(user?.fullName)} (${esc(user?.email)})`,
    `Amount: <b>${(withdrawal.amountCents / 100).toFixed(2)} USDT</b> (BEP20)`,
    `To: <code>${esc(withdrawal.address)}</code>`,
    `Process it: ${env.clientUrl}/admin/referrals`,
  ]
  return notifyAdminsTelegram(lines.join('\n'))
}

/** A wallet payment was accepted instantly but the chain doesn't back it up (yet). `user` needs fullName / email. */
export function notifyUnverifiedPayment(order, user, reason) {
  const lines = [
    '🚨 <b>Completed USDT order could NOT be verified on-chain</b>',
    `Order: <b>${esc(order.orderCode)}</b>`,
    `Investor: ${esc(user?.fullName)} (${esc(user?.email)})`,
    `Amount: <b>${(order.amountCents / 100).toFixed(2)} USDT</b> · ${order.shares} Class ${esc(order.shareType)} shares`,
    `Tx: <code>${esc(order.txHash)}</code>`,
    `Reason: ${esc(reason)}`,
    `Check it: ${REVIEW_URL().replace('?status=pending_review', '')}`,
  ]
  return notifyAdminsTelegram(lines.join('\n'))
}

/** A payment that needs an admin to check it and press Approve. `user` needs fullName / email / referralCode. */
export function notifyPaymentNeedsReview(order, user, { method, reference, reason } = {}) {
  const lines = [
    method === 'zelle' ? '💸 <b>Zelle payment — please verify</b>' : '⚠️ <b>USDT payment needs manual review</b>',
    `Order: <b>${esc(order.orderCode)}</b>`,
    `Investor: ${esc(user?.fullName)} (${esc(user?.email)})`,
    `Amount: <b>${(order.amountCents / 100).toFixed(2)} ${method === 'zelle' ? 'USD' : 'USDT'}</b> · ${order.shares} Class ${esc(order.shareType)} shares`,
    reference ? `Zelle confirmation: ${esc(reference)}` : null,
    order.txHash ? `Tx: <code>${esc(order.txHash)}</code>` : null,
    reason ? `Reason: ${esc(reason)}` : null,
    method === 'zelle' ? `Check that the memo is <b>${esc(order.orderCode)}</b>.` : null,
    `Review & approve: ${REVIEW_URL()}`,
  ]
  return notifyAdminsTelegram(lines.filter(Boolean).join('\n'))
}
