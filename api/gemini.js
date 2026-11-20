// Vercel serverless function — POST /api/gemini
// All Gemini calls go through here; GEMINI_API_KEY never reaches the browser.

const MODELS = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'] // tried in order; skips to the next on 503/404/timeout
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
  // Exact production URL
  if (origin === 'https://aisle-grocery-list.vercel.app') return true
  // Preview deployments: https://aisle-grocery-list-*.vercel.app
  if (/^https:\/\/aisle-grocery-list-[^.]+\.vercel\.app$/.test(origin)) return true
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

  const result = await model.generateContent(prompt)

  let text = result.response.text().trim()
  if (text.startsWith('```')) text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()

  const m = text.match(/\[[\s\S]*\]/)
  const arr = JSON.parse(m ? m[0] : text)
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

  if (task !== 'sort' && task !== 'parse') return res.status(400).json({ error: 'Unknown task' })

  // Direct REST call (no SDK) so we can turn off "thinking" for speed.
  const makeModel = (name) => ({
    async generateContent(input) {
      const base = typeof input === 'string'
        ? { contents: [{ role: 'user', parts: [{ text: input }] }] }
        : { ...input }
      const call = async (withThinking) => {
        const body = {
          ...base,
          generationConfig: {
            ...(base.generationConfig || {}),
            ...(withThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 4500)
        try {
          return await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`,
            { method: 'POST', signal: ctrl.signal,
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
              body: JSON.stringify(body) })
        } finally { clearTimeout(t) }
      }
      let r = await call(true)
      if (r.status === 400) r = await call(false) // model rejects thinking config
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`)
      const data = await r.json()
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')
      return { response: { text: () => text } }
    },
  })
  const run = (model) =>
    task === 'sort' ? handleSort(model, payload, res) : handleParse(model, payload, res)

  // Try each model once; log how long each took.
  let lastErr
  for (const name of MODELS) {
    const t0 = Date.now()
    try {
      const out = await run(makeModel(name))
      console.log(`[api/gemini] ${name} ok in ${Date.now() - t0}ms`)
      return out
    } catch (err) {
      lastErr = err
      console.error(`[api/gemini] ${name} failed after ${Date.now() - t0}ms:`, err.message)
    }
  }
  // Never expose upstream errors or keys
  return res.status(502).json({ error: 'Service busy, try again' })
}
