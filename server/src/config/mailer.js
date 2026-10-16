import nodemailer from 'nodemailer'
import env from './env.js'

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  auth: { user: env.smtp.user, pass: env.smtp.pass },
  // Fail fast instead of hanging a request (e.g. registration) for minutes on a bad connection
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
})

export default transporter
