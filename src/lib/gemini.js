// All Gemini calls go through /api/gemini (Vercel serverless).
// No API key in this file — VITE_GEMINI_API_KEY is no longer used.
import { detectStore, detectCategory, getLearnedAssignments } from '../utils/storeDetection'

function toSentenceCase(str) {
  const s = str.toLowerCase().trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// storeOptions: [{ id, fullName, ... }]
// Returns { storeId, category } or null on failure/timeout
export async function suggestItem(itemName, storeOptions) {
  if (!itemName.trim() || storeOptions.length === 0) return null
  try {
    const res = await Promise.race([
      fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'sort', payload: { itemName, storeOptions } }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Split a spoken grocery list via Gemini (server-side, 4 s timeout).
// Returns [{name, storeId, category}] or null on failure.
export async function parseList(rawText, storeOptions) {
  if (!rawText.trim() || storeOptions.length === 0) return null
  try {
    const res = await Promise.race([
      fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'parse', payload: { rawText, storeOptions } }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ])
    if (!res.ok) return null
    const items = await res.json()
    return Array.isArray(items) && items.length ? items : null
  } catch {
    return null
  }
}

// Instant local fallback — no network.
// Splits on explicit separators AND before capitalized words that follow a
// lowercase word (iOS capitalizes the first word of each new spoken phrase).
export function splitQuick(rawText, allStoreOrder) {
  if (!rawText.trim()) return []

  // 1. Split on explicit separator phrases
  const explicitParts = rawText.split(/,\s*|\s+and\s+|\s+then\s+|\s+plus\s+/gi)

  // 2. Within each part split before Capitalized words when previous word is lowercase
  const segments = []
  for (const part of explicitParts) {
    const words = part.trim().split(/\s+/)
    let current = []
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const prev = words[i - 1]
      if (i > 0 && /^[A-Z]/.test(word) && prev && /^[a-z]/.test(prev)) {
        if (current.length) segments.push(current.join(' '))
        current = [word]
      } else {
        current.push(word)
      }
    }
    if (current.length) segments.push(current.join(' '))
  }

  // 3. Assign each segment a storeId and category via keyword rules
  const learned = getLearnedAssignments()
  return segments
    .map(seg => {
      const trimmed = seg.trim()
      if (trimmed.length < 2) return null
      const name = toSentenceCase(trimmed)
      const lower = trimmed.toLowerCase()
      const learnedId = learned[lower]
      const { storeId: kwId, confident } = detectStore(trimmed)
      const storeId =
        learnedId && allStoreOrder.includes(learnedId) ? learnedId :
        confident && kwId && allStoreOrder.includes(kwId) ? kwId :
        allStoreOrder[0] ?? null
      if (!storeId) return null
      const category = detectCategory(trimmed, storeId)
      return { name, storeId, category }
    })
    .filter(Boolean)
}
