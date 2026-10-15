import mongoose from 'mongoose'
import env from './env.js'

export async function connectDB() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not set')
  await mongoose.connect(env.mongodbUri)
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
}
