import app from './app.js'
import env from './config/env.js'
import { connectDB } from './config/db.js'
import mailer from './config/mailer.js'
import { migrateSettings } from './models/Setting.js'
import { seedSupportArticles } from './models/SupportArticle.js'
import { startBep20Watcher } from './services/order.service.js'

async function start() {
  try {
    await connectDB()
    await migrateSettings()
    await seedSupportArticles()
    app.listen(env.port, () => console.log(`Server running at http://localhost:${env.port}`))
    startBep20Watcher()
    mailer
      .verify()
      .then(() => console.log(`SMTP ready (${env.smtp.user}@${env.smtp.host})`))
      .catch((err) => console.warn(`⚠️  SMTP not working — emails will fail: ${err.response ?? err.message}`))
  } catch (err) {
    console.error('Failed to start server:', err.message)
    process.exit(1)
  }
}

start()
