import mongoose from 'mongoose'

export const TICKET_CATEGORIES = ['kyc', 'face_2fa', 'payments', 'share_transactions', 'referral', 'account']
export const TICKET_STATUS = {
  RECEIVED: 'received', // new, not picked up yet
  IN_PROGRESS: 'in_progress',
  WAITING_FOR_USER: 'waiting_for_user', // support replied and needs the investor's answer
  RESOLVED: 'resolved',
}
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent']
export const OPEN_TICKET_STATUSES = [TICKET_STATUS.RECEIVED, TICKET_STATUS.IN_PROGRESS]
export const MAX_TICKET_ATTACHMENTS = 5

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true }, // file in storage/support
    originalName: String,
    mimeType: String,
    size: Number,
  },
  { _id: true },
)

const messageSchema = new mongoose.Schema(
  {
    author: { type: String, enum: ['user', 'admin'], required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    body: { type: String, required: true },
    attachments: [attachmentSchema],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// Internal notes are only ever shown to admins
const noteSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    body: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

/** Support-side history of the ticket (creation is derived from createdAt, not stored). */
const eventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['status', 'priority', 'assignment', 'escalated'], required: true },
    from: String,
    to: String,
    actorType: { type: String, enum: ['admin', 'investor', 'system'], required: true },
    actorName: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

const supportTicketSchema = new mongoose.Schema(
  {
    ticketCode: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true },
    errorCode: { type: String, trim: true },
    relatedTransaction: { type: String, trim: true },
    status: { type: String, enum: Object.values(TICKET_STATUS), default: TICKET_STATUS.RECEIVED, index: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'normal', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },
    // The first message holds the description and the screenshots submitted with the request
    messages: [messageSchema],
    lastActivityAt: { type: Date, default: Date.now, index: true },
    resolvedAt: Date,
    firstResponseAt: Date, // first support reply, for response-time metrics
    escalatedAt: Date,
    escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    notes: [noteSchema],
    events: [eventSchema],
  },
  { timestamps: true },
)

export default mongoose.model('SupportTicket', supportTicketSchema)
