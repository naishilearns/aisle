import { useState, useEffect, useRef } from 'react'
import { HINT_CHIPS } from '../constants'
import { detectStore, detectCategory, saveLearnedAssignment, getLearnedAssignments } from '../utils/storeDetection'
import { suggestItem } from '../lib/gemini'
import { storeColors } from '../utils/storeColors'
import DisambiguationCard from './DisambiguationCard'
import PrimaryButton from './PrimaryButton'

function toSentenceCase(str) {
  const lower = str.toLowerCase().trim()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export default function AddSheet({ open, onClose, onAdd, items = [], allStores = {}, allStoreOrder = [], theme = 'dark' }) {
  const [value, setValue] = useState('')
  const [disambiguation, setDisambiguation] = useState(null)
  const [flash, setFlash] = useState(false)
  const [duplicate, setDuplicate] = useState(null)
  // null = idle, 'loading' = fetching, { storeId, category } = result
  const [geminiSuggestion, setGeminiSuggestion] = useState(null)

  const inputRef = useRef(null)
  const duplicateTimerRef = useRef(null)
  const geminiDebounceRef = useRef(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setDisambiguation(null)
      setFlash(false)
      setDuplicate(null)
      setGeminiSuggestion(null)
      clearTimeout(geminiDebounceRef.current)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    return () => {
      clearTimeout(duplicateTimerRef.current)
      clearTimeout(geminiDebounceRef.current)
    }
  }, [open])

  // Debounced Gemini suggestion on value change
  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed.length <= 1) {
      setGeminiSuggestion(null)
      clearTimeout(geminiDebounceRef.current)
      return
    }

    setGeminiSuggestion('loading')
    clearTimeout(geminiDebounceRef.current)

    const storeOptions = allStoreOrder
      .filter(id => allStores[id])
      .map(id => ({ id, ...allStores[id] }))

    geminiDebounceRef.current = setTimeout(async () => {
      // Check learned assignment first
      const learned = getLearnedAssignments()
      const learnedStoreId = learned[trimmed.toLowerCase()]
      const learnedStoreValid = learnedStoreId && allStoreOrder.includes(learnedStoreId)

      const result = await suggestItem(trimmed, storeOptions)

      if (result) {
        // Learned store wins, but use Gemini's category
        const storeId = learnedStoreValid ? learnedStoreId : result.storeId
        setGeminiSuggestion({ storeId, category: result.category })
      } else {
        // Gemini failed — fall back to keyword rules silently
        const { storeId: kwStoreId } = detectStore(trimmed)
        const validKwStore = kwStoreId && allStoreOrder.includes(kwStoreId) ? kwStoreId : null
        if (validKwStore) {
          setGeminiSuggestion({ storeId: validKwStore, category: detectCategory(trimmed) })
        } else {
          setGeminiSuggestion(null)
        }
      }
    }, 300)

    return () => clearTimeout(geminiDebounceRef.current)
  }, [value, allStoreOrder, allStores])

  function checkDuplicate(name) {
    const normalized = name.trim().toLowerCase()
    const existing = items.find(i => i.name.toLowerCase() === normalized)
    if (existing) {
      const store = allStores[existing.store]
      const storeName = store?.fullName ?? existing.store
      return { name: existing.name, storeName }
    }
    return null
  }

  function showDuplicateToast(info) {
    clearTimeout(duplicateTimerRef.current)
    setDuplicate(info)
    duplicateTimerRef.current = setTimeout(() => setDuplicate(null), 2000)
  }

  const trimmed = value.trim()
  const orderedStores = allStoreOrder
    .filter(id => allStores[id])
    .map(id => ({ id, ...allStores[id] }))

  const isLoadingSuggestion = geminiSuggestion === 'loading'
  const suggestion = geminiSuggestion && geminiSuggestion !== 'loading' ? geminiSuggestion : null
  const suggestedStoreId = suggestion?.storeId && allStoreOrder.includes(suggestion.storeId)
    ? suggestion.storeId
    : null
  const suggestedCategory = suggestion?.category ?? null

  function handleSubmit(nameOverride) {
    const rawName = (nameOverride || value).trim()
    if (!rawName) return

    const dup = checkDuplicate(rawName)
    if (dup) { showDuplicateToast(dup); return }

    const name = toSentenceCase(rawName)

    // Use Gemini suggestion if ready and valid
    if (suggestion && suggestedStoreId) {
      onAdd({ name, store: suggestedStoreId, category: suggestion.category })
      setValue('')
      setDisambiguation(null)
      setGeminiSuggestion(null)
      triggerFlash()
      return
    }

    // Fall back to keyword rules
    const { storeId, confident } = detectStore(name)
    const validStoreId = storeId && allStoreOrder.includes(storeId) ? storeId : null

    if (confident && validStoreId) {
      const category = detectCategory(name, validStoreId)
      onAdd({ name, store: validStoreId, category })
      setValue('')
      setDisambiguation(null)
      triggerFlash()
    } else {
      setDisambiguation({ itemName: name })
    }
  }

  function handleStoreSelect(storeId) {
    const name = disambiguation.itemName
    saveLearnedAssignment(name, storeId)
    const category = suggestedCategory || detectCategory(name, storeId)
    onAdd({ name, store: storeId, category })
    setValue('')
    setDisambiguation(null)
    setGeminiSuggestion(null)
    triggerFlash()
  }

  function handleStoreChipAdd(storeId) {
    const rawName = value.trim()
    if (!rawName) return
    const dup = checkDuplicate(rawName)
    if (dup) { showDuplicateToast(dup); return }
    const name = toSentenceCase(rawName)
    saveLearnedAssignment(name, storeId)
    const category = suggestedCategory || detectCategory(name, storeId)
    onAdd({ name, store: storeId, category })
    setValue('')
    setDisambiguation(null)
    setGeminiSuggestion(null)
    triggerFlash()
  }

  function triggerFlash() {
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'var(--overlay)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Gap filler */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 50,
          backgroundColor: 'var(--sheet-bg)', zIndex: 49,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          backgroundColor: 'var(--sheet-bg)', color: 'var(--text)',
          borderRadius: '32px 32px 0 0',
          border: '1px solid var(--border)', borderBottom: 'none',
          animation: 'slideUp 350ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'var(--drag-handle)' }} />
        </div>

        <div style={{ padding: '0 20px', paddingBottom: 'max(34px, env(safe-area-inset-bottom))' }}>
          {/* Title */}
          <p style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>What do you need?</p>

          {/* Subtitle */}
          <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-mid)' }}>
            {isLoadingSuggestion
              ? 'Finding the best store\u2026'
              : suggestedCategory
                ? `Looks like ${suggestedCategory.toLowerCase()}`
                : "We'll figure out the store"}
          </p>

          {/* Bordered input with mic inside */}
          <div style={{
            height: 56, borderRadius: 18, border: '1.5px solid var(--input-border)',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 8px 0 16px',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => { setValue(e.target.value); setDisambiguation(null); setDuplicate(null) }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. olive oil"
              className="bg-transparent outline-none"
              style={{
                flex: 1,
                fontSize: 16, fontWeight: 600,
                color: value ? 'var(--input-color)' : 'var(--text-mid)',
                caretColor: 'var(--caret)',
                border: 'none', padding: 0,
                fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {flash ? (
              <span style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'var(--hint-chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--flash-color)', fontSize: 16 }}>✓</span>
            ) : (
              <span style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'var(--hint-chip-bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                  <rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>
                </svg>
              </span>
            )}
          </div>

          {/* Duplicate toast */}
          {duplicate && (
            <div
              style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 16,
                backgroundColor: 'var(--dup-toast-bg)',
                border: '1px solid var(--dup-toast-border)',
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'fadeIn 150ms ease forwards',
              }}
            >
              <span style={{ fontSize: 14, color: '#FF7BAC' }}>✦</span>
              <p style={{ color: 'var(--dup-toast-text)', fontSize: 13, fontWeight: 500, margin: 0 }}>
                Already in your list — {duplicate.storeName}
              </p>
            </div>
          )}

          {/* Hint chips — shown when input is empty */}
          {trimmed.length === 0 && !duplicate && (
            <div style={{ margin: '14px -20px 0', padding: '0 20px', display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden' }} className="no-scrollbar">
              {HINT_CHIPS.map(chip => (
                <span
                  key={chip}
                  onClick={() => { setValue(chip); setTimeout(() => inputRef.current?.focus(), 0) }}
                  style={{
                    flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 18,
                    backgroundColor: 'var(--hint-chip-bg)',
                    display: 'flex', alignItems: 'center',
                    fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* STORE section — always visible */}
          <p style={{ margin: '20px 0 10px', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-mid)' }}>
            Store
          </p>
          <div style={{ margin: '0 -20px', padding: '0 20px', display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden' }} className="no-scrollbar">
            {/* Auto chip */}
            <span
              style={{
                flexShrink: 0, height: 40, padding: '0 14px', borderRadius: 20,
                backgroundColor: 'var(--tab-active-bg)', color: 'var(--tab-active-text)',
                display: 'flex', alignItems: 'center',
                font: '800 13px "Plus Jakarta Sans",sans-serif',
                animation: isLoadingSuggestion ? 'chipPulse 1s ease-in-out infinite' : 'none',
              }}
            >
              Auto
            </span>
            {/* Store chips — click to add directly to that store */}
            {orderedStores.map(store => {
              const isSuggested = suggestedStoreId === store.id && trimmed.length > 0
              const colors = storeColors(store.color, theme)
              return (
                <button
                  key={store.id}
                  onClick={() => handleStoreChipAdd(store.id)}
                  style={{
                    flexShrink: 0, height: 40, padding: '0 14px', borderRadius: 20,
                    backgroundColor: isSuggested ? colors.deep : 'transparent',
                    border: `1.5px solid ${isSuggested ? colors.deep : 'var(--input-border)'}`,
                    color: isSuggested ? '#FFFFFF' : 'var(--text)',
                    font: `${isSuggested ? 800 : 700} 13px "Plus Jakarta Sans",sans-serif`,
                    whiteSpace: 'nowrap', cursor: trimmed.length === 0 ? 'default' : 'pointer',
                    opacity: trimmed.length === 0 ? 0.5 : 1,
                    transition: 'background-color 200ms ease, border-color 200ms ease, color 200ms ease',
                  }}
                >
                  {store.label}
                </button>
              )
            })}
          </div>

          {/* Disambiguation fallback */}
          {disambiguation && (
            <DisambiguationCard
              itemName={disambiguation.itemName}
              onSelectStore={handleStoreSelect}
              stores={allStores}
            />
          )}

          {/* Add item button — always visible */}
          <div style={{ marginTop: 22 }}>
            <PrimaryButton onClick={() => handleSubmit()}>
              Add item
            </PrimaryButton>
          </div>
        </div>
      </div>
    </>
  )
}
