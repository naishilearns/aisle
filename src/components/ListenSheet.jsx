import { useState, useEffect, useRef } from 'react'
import { useSpeech } from '../lib/speech'
import { parseList, splitQuick } from '../lib/gemini'
import { storeColors } from '../utils/storeColors'
import StoreIcon from './StoreIcon'

// Heights (px) for the 15 waveform bars — reference-matched
const BAR_HEIGHTS = [18, 30, 46, 28, 56, 36, 22, 50, 32, 62, 40, 24, 44, 28, 18]

// Renders transcript text with store-colored inline pills for each parsed item.
// If a parsed item's name can't be found in the raw text, it's silently skipped
// and the unmatched text shows un-highlighted.
function TranscriptText({ finalText, parsedItems, allStores, theme, interim }) {
  if (!finalText && !interim) {
    return <span style={{ color: 'var(--text-mid)' }}>Say your grocery list…</span>
  }

  let remaining = finalText
  const nodes = []

  for (let i = 0; i < parsedItems.length; i++) {
    const item = parsedItems[i]
    const lowerR = remaining.toLowerCase()
    const lowerN = item.name.toLowerCase()
    const idx = lowerR.indexOf(lowerN)
    if (idx < 0) continue
    if (idx > 0) nodes.push(<span key={`pre-${i}`}>{remaining.slice(0, idx)}</span>)
    const store = allStores[item.storeId]
    const bgColor = storeColors(store?.color || '#888', theme).ring
    nodes.push(
      <span key={`pill-${i}`} style={{ padding: '1px 8px', borderRadius: 10, backgroundColor: bgColor, color: '#FFFFFF' }}>
        {remaining.slice(idx, idx + item.name.length)}
      </span>
    )
    remaining = remaining.slice(idx + item.name.length)
  }
  if (remaining) nodes.push(<span key="tail">{remaining}</span>)
  if (interim) {
    nodes.push(
      <span key="interim" style={{ color: 'var(--text-mid)' }}>
        {finalText ? ' ' : ''}{interim}
      </span>
    )
  }

  return <>{nodes}</>
}

export default function ListenSheet({ open, onClose, onDone, allStores = {}, allStoreOrder = [], theme = 'dark' }) {
  const { listening, interim, finalText, start, stop, error } = useSpeech()
  const [emptyWarning, setEmptyWarning] = useState(false)
  const [parsedItems, setParsedItems] = useState([])
  const [isSorting, setIsSorting] = useState(false)

  // Version counter — incremented to cancel stale async parses
  const liveParseVersionRef = useRef(0)

  // Safety: abort recognition if the sheet unmounts unexpectedly
  useEffect(() => {
    return () => stop()
  }, [stop])

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!open) {
      setParsedItems([])
      setIsSorting(false)
      setEmptyWarning(false)
    }
  }, [open])

  // Live parse: show splitQuick immediately, then replace with Gemini after 900 ms
  useEffect(() => {
    const combined = [finalText, interim].filter(Boolean).join(' ').trim()
    if (!combined) {
      setParsedItems([])
      return
    }

    // Instant chip display via local fallback
    setParsedItems(splitQuick(combined, allStoreOrder))

    // Debounce Gemini live parse
    const version = ++liveParseVersionRef.current
    const storeOptions = allStoreOrder
      .filter(id => allStores[id])
      .map(id => ({ id, ...allStores[id] }))

    const timer = setTimeout(async () => {
      const result = await parseList(combined, storeOptions)
      if (liveParseVersionRef.current === version && result?.length) {
        setParsedItems(result)
      }
    }, 900)

    return () => clearTimeout(timer)
  }, [finalText, interim]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    stop()
    onClose()
  }

  async function handleMicTap() {
    if (!listening) {
      setEmptyWarning(false)
      start()
      return
    }

    // User tapped Done
    stop()
    const combined = [finalText, interim].filter(Boolean).join(' ').trim()
    if (!combined) {
      setEmptyWarning(true)
      return
    }

    // Cancel any in-flight live parse
    liveParseVersionRef.current++

    // Show quick items immediately while Gemini works
    const quick = splitQuick(combined, allStoreOrder)
    setParsedItems(quick)
    setIsSorting(true)

    const storeOptions = allStoreOrder
      .filter(id => allStores[id])
      .map(id => ({ id, ...allStores[id] }))

    const geminiItems = await parseList(combined, storeOptions)
    const items = geminiItems?.length ? geminiItems : quick

    setIsSorting(false)
    onDone?.({ rawText: combined, items })
  }

  // Waveform bar colors: cycle through active stores' ring colors
  const cycleStores = (() => {
    const preferred = ['fredmeyer', 'tjs', 'indian', 'costco'].filter(id => allStoreOrder.includes(id))
    const rest = allStoreOrder.filter(id => !preferred.includes(id))
    return [...preferred, ...rest]
  })()

  const barColors = BAR_HEIGHTS.map((_, i) => {
    const storeId = cycleStores[i % Math.max(cycleStores.length, 1)]
    const store = allStores[storeId]
    return storeColors(store?.color || '#888', theme).ring
  })

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'var(--bg)',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'calc(env(safe-area-inset-top, 44px) + 18px) 20px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            width: 44, height: 44, borderRadius: 22, border: 0,
            background: 'var(--surface)', boxShadow: 'var(--shadow-card)',
            color: 'var(--text)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>

        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7BAC', flexShrink: 0 }} />
          {isSorting ? 'Sorting your list…' : 'Listening'}
        </span>

        <span style={{ width: 44, flexShrink: 0 }} />
      </div>

      {/* Transcript + item chips */}
      <div style={{ padding: '32px 24px 0', paddingBottom: 280, overflowY: 'auto', maxHeight: '100%' }}>
        {error ? (
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--danger)', lineHeight: 1.5 }}>{error}</p>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.55, color: 'var(--text)' }}>
              <TranscriptText
                finalText={finalText}
                parsedItems={parsedItems}
                allStores={allStores}
                theme={theme}
                interim={interim}
              />
            </p>
            {emptyWarning && !finalText && !interim && (
              <p style={{ margin: '16px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--text-mid)' }}>
                I didn't catch anything — tap the mic and try again
              </p>
            )}
          </>
        )}

        {/* Item chips — flex-wrap, truncate long names */}
        {parsedItems.length > 0 && (
          <div style={{ marginTop: 26, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {parsedItems.map((item, i) => {
              const store = allStores[item.storeId]
              const bg = storeColors(store?.color || '#888', theme).ring
              return (
                <span
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    height: 40, padding: '0 14px 0 8px', borderRadius: 20,
                    backgroundColor: bg, color: '#FFFFFF',
                    fontSize: 14, fontWeight: 700,
                    maxWidth: '100%', minWidth: 0,
                    animation: 'springIn 250ms cubic-bezier(0.34,1.56,0.64,1) both',
                  }}
                >
                  <span style={{
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: 'rgba(255,255,255,.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <StoreIcon storeId={item.storeId} size={15} color="#FFFFFF" strokeWidth={2.1} />
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Waveform bars */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 178,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, height: 72, pointerEvents: 'none',
        }}
      >
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            style={{
              flexShrink: 0, width: 10, height: h, borderRadius: 5,
              backgroundColor: barColors[i],
              transformOrigin: 'center bottom',
              animation: listening
                ? `waveBar ${0.5 + (i % 7) * 0.09}s ease-in-out ${i * 0.035}s infinite alternate`
                : 'none',
            }}
          />
        ))}
      </div>

      {/* Mic button + label */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingBottom: 'max(40px, env(safe-area-inset-bottom, 40px))',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {listening && (
            <span style={{
              position: 'absolute', inset: 0, borderRadius: 44,
              backgroundColor: '#FF7BAC',
              animation: 'micRing 1.8s cubic-bezier(.5,0,0,1) infinite',
            }} />
          )}
          <button
            onClick={handleMicTap}
            disabled={isSorting}
            aria-label={listening ? 'Stop listening' : 'Start listening'}
            style={{
              position: 'relative', width: 88, height: 88, borderRadius: 44,
              border: 0, backgroundColor: '#FF7BAC', color: '#FFFFFF',
              boxShadow: '0 8px 22px rgba(255,123,172,.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isSorting ? 'default' : 'pointer',
              opacity: isSorting ? 0.6 : 1,
              transition: 'opacity 200ms ease',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
              <rect x="9" y="3" width="6" height="12" rx="3"/>
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>
            </svg>
          </button>
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--text-mid)' }}>
          {isSorting ? 'One sec…' : listening ? "Tap when you're done" : 'Tap to start'}
        </p>
      </div>
    </div>
  )
}
