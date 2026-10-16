import transporter from '../config/mailer.js'
import env from '../config/env.js'

const TRANSIENT_CODES = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'EDNS', 'ETLS'])
const isTransient = (err) => TRANSIENT_CODES.has(err.code) || (err.responseCode >= 400 && err.responseCode < 500)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sends an email, retrying twice on connection problems / temporary SMTP errors, and logs the outcome
 * (recipient + server response only — never the subject, which can contain a one-time code).
 */
export async function sendMail({ to, subject, html, text, attachments }) {
  const attempts = 3
  for (let attempt = 1; ; attempt++) {
    try {
      const info = await transporter.sendMail({ from: env.mail.from, to, subject, html, text, attachments })
      console.log(`[mail] sent to ${to} (attempt ${attempt}) — ${info.response}`)
      return info
    } catch (err) {
      const retry = attempt < attempts && isTransient(err)
      console.error(`[mail] FAILED to ${to} (attempt ${attempt}/${attempts})${retry ? ', retrying' : ''} — ${err.code ?? ''} ${err.responseCode ?? ''} ${err.response ?? err.message}`)
      if (!retry) throw err
      await sleep(1000 * attempt)
    }
  }
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const layout = (content) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 16px">${escapeHtml(env.appName)}</h2>
    ${content}
    <p style="margin-top:32px;font-size:12px;color:#888">This is an automated message, please do not reply.</p>
  </div>
`

export function sendVerificationCodeEmail(user, code, expiresInMinutes) {
  return sendMail({
    to: user.email,
    subject: `${code} is your ${env.appName} verification code`,
    text: `Hi ${user.fullName}, your verification code is ${code}. It expires in ${expiresInMinutes} minutes.`,
    html: layout(`
      <p>Hi ${escapeHtml(user.fullName)},</p>
      <p>Use the code below to confirm your email address:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p>
      <p>This code expires in ${expiresInMinutes} minutes. If you didn't create an account, you can ignore this email.</p>
    `),
  })
}

export function sendPasswordResetCodeEmail(user, code, expiresInMinutes) {
  return sendMail({
    to: user.email,
    subject: `${code} is your ${env.appName} password reset code`,
    text: `Hi ${user.fullName}, your password reset code is ${code}. It expires in ${expiresInMinutes} minutes.`,
    html: layout(`
      <p>Hi ${escapeHtml(user.fullName)},</p>
      <p>Use the code below to reset your password:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p>
      <p>This code expires in ${expiresInMinutes} minutes. If you didn't ask to reset your password, you can ignore this email — your password won't change.</p>
    `),
  })
}

export function sendAccountApprovedEmail(user) {
  return sendMail({
    to: user.email,
    subject: `Your ${env.appName} account has been approved`,
    html: layout(`
      <p>Hi ${escapeHtml(user.fullName)},</p>
      <p>Your account has been approved. You can now sign in.</p>
      <p><a href="${env.clientUrl}/login">Sign in</a></p>
    `),
  })
}

export function sendAccountRejectedEmail(user) {
  return sendMail({
    to: user.email,
    subject: `Your ${env.appName} account application`,
    html: layout(`
      <p>Hi ${escapeHtml(user.fullName)},</p>
      <p>Unfortunately your account application was not approved.</p>
      ${user.rejectionReason ? `<p><b>Reason:</b> ${escapeHtml(user.rejectionReason)}</p>` : ''}
    `),
  })
}
