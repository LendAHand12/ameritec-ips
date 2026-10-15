import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import Admin from '../src/models/Admin.js'
import { normalizeEmail } from '../src/utils/normalize.js'

const email = normalizeEmail(process.env.ADMIN_EMAIL)
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first')
  process.exit(1)
}

await connectDB()

let admin = await Admin.findOne({ email })
if (admin) {
  admin.password = password
  admin.isActive = true
  console.log(`Updated password for admin ${email}`)
} else {
  admin = new Admin({ fullName: 'Administrator', email, password })
  console.log(`Created admin ${email}`)
}
await admin.save()

await mongoose.disconnect()
