/** "Michael Thompson" → "Michael T." — network members only see each other's first name + last initial. */
export function shortName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? 'Member'
  return `${parts[0]} ${parts.at(-1)[0].toUpperCase()}.`
}
