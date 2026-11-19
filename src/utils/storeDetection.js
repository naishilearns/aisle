import { KEYWORDS, UNIVERSAL_CATEGORY_KEYWORDS } from '../constants'

const LEARNED_KEY = 'aisle-learned'

export function getLearnedAssignments() {
  try {
    return JSON.parse(localStorage.getItem(LEARNED_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveLearnedAssignment(itemName, storeId) {
  const learned = getLearnedAssignments()
  learned[itemName.toLowerCase().trim()] = storeId
  localStorage.setItem(LEARNED_KEY, JSON.stringify(learned))
}

export function loadLearnedFromRemote(learned) {
  if (learned && typeof learned === 'object') {
    localStorage.setItem(LEARNED_KEY, JSON.stringify(learned))
  }
}

export function detectStore(itemName) {
  const lower = itemName.toLowerCase().trim()

  // Check learned assignments first
  const learned = getLearnedAssignments()
  if (learned[lower]) {
    return { storeId: learned[lower], confident: true }
  }

  // Rule-based: check each store's keywords (priority order matters)
  const priorityOrder = ['tjs', 'indian', 'costco', 'fredmeyer']

  for (const storeId of priorityOrder) {
    const keywords = KEYWORDS[storeId]
    if (!keywords) continue
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return { storeId, confident: true }
      }
    }
  }

  return { storeId: null, confident: false }
}

// Category is determined by item name, not store — universal across all stores
export function detectCategory(itemName, _storeId) {
  const lower = itemName.toLowerCase().trim()

  for (const [category, keywords] of Object.entries(UNIVERSAL_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category
    }
  }

  return 'Pantry'
}
