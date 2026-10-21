import mongoose from 'mongoose'

/** A message an admin sends to one user or to everyone. */
const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    audience: { type: String, enum: ['all', 'user'], required: true },
    // Only for audience 'user'
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
notificationSchema.index({ audience: 1, createdAt: -1 })

/** Which user has read which notification (a broadcast is read separately by each person). */
const readSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notification: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)
readSchema.index({ user: 1, notification: 1 }, { unique: true })

export const NotificationRead = mongoose.model('NotificationRead', readSchema)
export default mongoose.model('Notification', notificationSchema)
