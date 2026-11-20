// Vercel serverless function — POST /api/gemini
// All Gemini calls go through here; GEMINI_API_KEY never reaches the browser.
import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL = 'gemini-2.5-flash'
const MAX_TEXT_LEN = 2000
const MAX_ITEMS = 50
const RL_WINDOW_MS = 60_000
const RL_MAX = 30

const VALID_CATEGORIES = [
  'Produce', 'Dairy', 'Protein', 'Frozen', 'Pantry',
  'Spices', 'Snacks', 'Beverages', 'Bakery', 'Household', 'Bulk',
]

// ─── In-memory per-IP rate limit (resets on cold start) ───────────────────────
const rlMap = new Map() // ip → { n, windowStart }

function checkRateLimit(ip) {
  const now = Date.now()
  const r = rlMap.get(ip)
  if (!r || now - r.w > RL_WINDOW_MS) {
    rlMap.set(ip, { n: 1, w: now })
    return true
  }
  if (r.n >= RL_MAX) return false
  r.n++
  return true
}

// ─── Origin guard ─────────────────────────────────────────────────────────────
function isAllowedOrigin(origin) {
  if (!origin) return false
  // Any localhost port (dev)
  if (/^https?:\/\/localhost(:\d+)?/.test(origin)) return true
  // Any *.vercel.app deployment (preview + production)
  if (/\.vercel\.app$/.test(origin)) return true
  // Custom production domain if configured
  const appUrl = process.env.APP_URL
  if (appUrl && origin.startsWith(appUrl)) return true
  return false
}

// ─── Task: sort (single-item store + category suggestion) ─────────────────────
async function handleSort(model, payload, res) {
  const { itemName, storeOptions } = payload ?? {}
  if (
    typeof itemName !== 'string' || !itemName.trim() || itemName.length > 200 ||
    !Array.isArray(storeOptions) || storeOptions.length === 0 || storeOptions.length > MAX_ITEMS
  ) return res.status(400).json({ error: 'Invalid payload' })

  const storeNames = storeOptions.map(s => s.fullName).join(', ')
  const prompt =
    `You are a grocery store assistant. Given an item name, return a JSON object with:\n` +
    `- "store": the most likely store from this list: ${storeNames}\n` +
    `- "category": one of: ${VALID_CATEGORIES.join(', ')}\n\n` +
    `Item: "${itemName.trim()}"\n\n` +
    `Reply with ONLY a valid JSON object. Example: {"store":"Trader Joe's","category":"Frozen"}`

  const result = await model.generateContent(prompt)
  let text = result.response.text().trim()
  if (text.startsWith('```')) text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()

  const json = JSON.parse(text)
  const matched = storeOptions.find(s => s.fullName === json.store)
  if (!matched) return res.status(200).json(null)

  const category = VALID_CATEGORIES.includes(json.category) ? json.category : 'Pantry'
  return res.status(200).json({ storeId: matched.id, category })
}

// ─── Task: parse (split spoken grocery list into items) ───────────────────────
async function handleParse(model, payload, res) {
  const { rawText, storeOptions } = payload ?? {}
  if (
    typeof rawText !== 'string' || !rawText.trim() || rawText.length > MAX_TEXT_LEN ||
    !Array.isArray(storeOptions) || storeOptions.length === 0 || storeOptions.length > MAX_ITEMS
  ) return res.status(400).json({ error: 'Invalid payload' })

  const storeList = storeOptions.map(s => `${s.id} = ${s.fullName}`).join('\n')
  const storeIds = storeOptions.map(s => s.id).join(', ')

  const prompt =
    `You are a grocery assistant. Split a spoken grocery list into individual items.\n\n` +
    `Rules:\n` +
    `- The transcript has no punctuation (spoken aloud). iOS capitalizes the first word of new phrases after pauses.\n` +
    `- Multi-word items like "Greek yogurt", "basmati rice", "cottage cheese" must stay as ONE item.\n` +
    `- Fix obvious speech-to-text errors in grocery context (e.g. "bear" → "pear").\n` +
    `- Sentence-case each name: capitalize only the first letter, rest lowercase.\n` +
    `- Assign each item to exactly one store ID from: ${storeIds}\n` +
    `- Assign a category from: ${VALID_CATEGORIES.join(', ')}\n\n` +
    `Stores:\n${storeList}\n\n` +
    `Transcript: "${rawText.trim()}"\n\n` +
    `Return ONLY a JSON array. Example:\n` +
    `[{"name":"Greek yogurt","storeId":"fredmeyer","category":"Dairy"},{"name":"Basmati rice","storeId":"indian","category":"Pantry"}]`

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  })

  let text = result.response.text().trim()
  if (text.startsWith('```')) text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()

  const arr = JSON.parse(text)
  if (!Array.isArray(arr)) return res.status(200).json([])

  const validIds = new Set(storeOptions.map(s => s.id))
  const items = arr
    .filter(item => item && typeof item.name === 'string' && item.name.trim())
    .map(item => ({
      name: item.name.trim(),
      storeId: validIds.has(item.storeId) ? item.storeId : storeOptions[0].id,
      category: VALID_CATEGORIES.includes(item.category) ? item.category : 'Pantry',
    }))

  return res.status(200).json(items)
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Origin check
  const origin = (req.headers.origin || req.headers.referer || '').split('/').slice(0, 3).join('/')
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Forbidden' })

  // Rate limit
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests' })

  // Parse body (Vercel auto-parses JSON bodies, but guard against string)
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }

  const { task, payload } = body ?? {}
  if (!task || !payload) return res.status(400).json({ error: 'Missing task or payload' })

  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: 'Service unavailable' })

  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: MODEL })

  try {
    if (task === 'sort') return await handleSort(model, payload, res)
    if (task === 'parse') return await handleParse(model, payload, res)
    return res.status(400).json({ error: 'Unknown task' })
  } catch (err) {
    // Never expose upstream errors or keys
    console.error('[api/gemini]', err.message)
    return res.status(500).json({ error: 'Service error' })
  }
}
