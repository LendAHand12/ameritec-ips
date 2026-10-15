import { ArrowLeftRightIcon, CheckIcon, ShieldCheckIcon, UsersIcon, WalletIcon } from 'lucide-react'
import { validateImageFile } from '@/components/auth/DocumentUpload'

export const SUPPORT_TABS = [
  { value: 'solutions', label: 'Find a Solution' },
  { value: 'new', label: 'Submit a Request' },
  { value: 'requests', label: 'My Requests' },
]

export const SUPPORT_CATEGORIES = [
  { value: 'kyc', label: 'Registration & KYC', icon: ShieldCheckIcon },
  { value: 'face_2fa', label: 'Face Scan & 2FA', icon: CheckIcon },
  { value: 'payments', label: 'USDT & Zelle Payments', icon: WalletIcon },
  { value: 'share_transactions', label: 'Share Transactions', icon: ArrowLeftRightIcon },
  { value: 'referral', label: 'Referral & Commission', icon: UsersIcon },
  { value: 'account', label: 'Account & Security', icon: ShieldCheckIcon },
]

export const CATEGORY_LABEL = Object.fromEntries(SUPPORT_CATEGORIES.map((c) => [c.value, c.label]))

export const TICKET_STATUS = {
  received: { label: 'Received', tone: 'brand' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  waiting_for_user: { label: 'Waiting for You', tone: 'violet' },
  resolved: { label: 'Resolved', tone: 'success' },
}

/** Admin-side wording ("Waiting for User" instead of "Waiting for You"). */
export const ADMIN_TICKET_STATUS = {
  received: { label: 'New', tone: 'brand' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  waiting_for_user: { label: 'Waiting for User', tone: 'neutral' },
  resolved: { label: 'Resolved', tone: 'success' },
}

export const TICKET_PRIORITY = {
  low: { label: 'Low', tone: 'neutral' },
  normal: { label: 'Normal', tone: 'neutral' },
  high: { label: 'High', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
}

export const MAX_ATTACHMENTS = 5
export const DESCRIPTION_MAX = 1000

/** Adds picked images to `files`, skipping invalid ones and anything over MAX_ATTACHMENTS. Returns { files, error }. */
export function mergeImageFiles(files, picked) {
  const list = [...picked]
  const valid = list.filter((f) => !validateImageFile(f))
  const room = MAX_ATTACHMENTS - files.length
  const error = list.map(validateImageFile).find(Boolean) ?? (valid.length > room ? `You can attach up to ${MAX_ATTACHMENTS} images` : null)
  return { files: [...files, ...valid.slice(0, Math.max(room, 0))], error }
}

/** Popular searches shown under the search box. */
export const POPULAR_SEARCHES = ['KYC rejected', 'Face Scan failed', '2FA code', 'USDT payment', 'Transaction failed', 'Commission missing']

export function searchArticles(articles, query, category) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return articles.filter((a) => {
    if (category && a.category !== category) return false
    const haystack = `${a.code} ${a.title} ${a.summary} ${a.keywords} ${CATEGORY_LABEL[a.category]}`.toLowerCase()
    return words.every((w) => haystack.includes(w))
  })
}
