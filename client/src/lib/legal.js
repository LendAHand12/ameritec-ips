import regulationD from '@/content/legal/regulationD'
import regulationS from '@/content/legal/regulationS'

// Placeholders until the Terms of Service / Privacy Policy pages exist
export const LEGAL_LINKS = {
  terms: '#terms',
  privacy: '#privacy',
  help: '#help',
}

// Offering documents shown at /legal/:doc
export const LEGAL_DOCS = {
  'regulation-d': { title: 'Regulation D — Rule 506(b) Private Offering Memorandum', short: 'Regulation D (U.S.)', blocks: regulationD },
  'regulation-s': { title: 'Regulation S — International Investor Information Memorandum', short: 'Regulation S (International)', blocks: regulationS },
}
