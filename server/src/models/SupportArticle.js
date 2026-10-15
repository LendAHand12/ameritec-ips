import mongoose from 'mongoose'
import { DEFAULT_SUPPORT_ARTICLES } from '../data/supportArticles.js'
import { TICKET_CATEGORIES } from './SupportTicket.js'

/** Help article shown in the investor's "Find a Solution" tab (the admin's Error Catalog). */
const supportArticleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    keywords: { type: String, default: '', trim: true }, // extra search terms, not shown
    steps: [{ type: String, trim: true }],
    published: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
)

const SupportArticle = mongoose.model('SupportArticle', supportArticleSchema)

/** Fills an empty catalog with the default articles (safe to run on every start). */
export async function seedSupportArticles() {
  if (await SupportArticle.estimatedDocumentCount()) return
  await SupportArticle.insertMany(DEFAULT_SUPPORT_ARTICLES)
}

export default SupportArticle
