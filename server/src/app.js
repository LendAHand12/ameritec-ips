import path from 'path'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import env from './config/env.js'
import routes from './routes/index.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'

const app = express()

if (env.isProd) app.set('trust proxy', 1)

app.use(cors({ origin: env.clientUrl, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(morgan(env.isProd ? 'combined' : 'dev'))

app.use('/uploads', express.static(path.resolve(env.upload.dir)))
app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)

export default app
