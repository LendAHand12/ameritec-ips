import transporter from '../config/mailer.js'
import env from '../config/env.js'

export function sendMail({ to, subject, html, text, attachments }) {
  return transporter.sendMail({ from: env.mail.from, to, subject, html, text, attachments })
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
