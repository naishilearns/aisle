import { GoogleGenerativeAI } from '@google/generative-ai'

const key = import.meta.env.VITE_GEMINI_API_KEY
const genAI = key ? new GoogleGenerativeAI(key) : null
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null

const VALID_CATEGORIES = [
  'Produce', 'Dairy', 'Protein', 'Frozen', 'Pantry',
  'Spices', 'Snacks', 'Beverages', 'Bakery', 'Household', 'Bulk',
]

// storeOptions: [{ id, fullName, ... }]
// Returns { storeId, category } or null on failure/timeout
export async function suggestItem(itemName, storeOptions) {
  if (!model || !itemName.trim() || storeOptions.length === 0) return null

  const storeNames = storeOptions.map(s => s.fullName).join(', ')
  const prompt = `You are a grocery store assistant. Given an item name, return a JSON object with:
- "store": the most likely store from this list: ${storeNames}
- "category": the grocery category (one of: Produce, Dairy, Protein, Frozen, Pantry, Spices, Snacks, Beverages, Bakery, Household, Bulk)

Item: "${itemName}"

Reply with ONLY a valid JSON object, no explanation, no markdown. Example: {"store":"Trader Joe's","category":"Frozen"}`

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])

    let text = result.response.text().trim()
    // Strip markdown code fences if Gemini wraps the response
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
    }

    const json = JSON.parse(text)
    const matched = storeOptions.find(s => s.fullName === json.store)
    if (!matched) return null

    const category = VALID_CATEGORIES.includes(json.category) ? json.category : 'Pantry'
    return { storeId: matched.id, category }
  } catch {
    return null
  }
}
