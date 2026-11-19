import { useState, useRef, useCallback } from 'react'

const Recognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

// Require HTTPS / localhost (isSecureContext is undefined on very old browsers — treat as ok)
export const speechSupported =
  typeof window !== 'undefined' &&
  (window.isSecureContext ?? true) &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition)

function mapError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone is blocked. Allow it in browser settings.'
    case 'network':
      return "Speech service couldn't connect. Check your connection and try again."
    case 'audio-capture':
      return 'No microphone found.'
    case 'no-speech':
    case 'aborted':
      return null // handled silently — onend will restart
    default:
      return null // unknown: let onend restart
  }
}

export function useSpeech() {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState(null)

  // ONE recognition instance, created lazily and reused for the entire session
  const recRef = useRef(null)
  // Tracks whether the browser's recognition is actually running right now
  const isRunningRef = useRef(false)
  // Set true when the user taps "start"; false only when they tap Done/close
  const wantListeningRef = useRef(false)
  // Consecutive restart attempts without a successful onresult — give up at 3
  const restartCountRef = useRef(0)
  // Accumulated final text across all restarts (not cleared on restart)
  const finalRef = useRef('')

  // Build (once) and return the single Recognition instance.
  // Defined as a plain function inside the hook — all state access goes through refs,
  // so the closure captured by useCallback is always correct.
  function ensureRec() {
    if (recRef.current) return recRef.current

    const rec = new Recognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => {
      isRunningRef.current = true
      restartCountRef.current = 0 // successful start → reset backoff
      setListening(true)
    }

    rec.onresult = (e) => {
      restartCountRef.current = 0 // got a result → reset backoff
      let inter = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          finalRef.current = (finalRef.current ? finalRef.current + ' ' : '') + t.trim()
          setFinalText(finalRef.current)
        } else {
          inter += t
        }
      }
      setInterim(inter)
    }

    rec.onerror = (e) => {
      console.warn('speech error', e.error)
      const msg = mapError(e.error)
      if (msg) {
        // Fatal error: stop trying
        wantListeningRef.current = false
        isRunningRef.current = false
        setListening(false)
        setError(msg)
      }
      // no-speech / aborted: onend fires next and will restart
    }

    rec.onend = () => {
      isRunningRef.current = false
      setInterim('')

      if (!wantListeningRef.current) {
        setListening(false)
        return
      }

      restartCountRef.current++
      if (restartCountRef.current > 3) {
        wantListeningRef.current = false
        setListening(false)
        setError('Speech service stopped. Tap the mic to try again.')
        return
      }

      // Restart after a short delay (iOS needs a breath between sessions)
      setTimeout(() => {
        if (!wantListeningRef.current) return
        try {
          rec.start()
        } catch (err) {
          console.warn('speech restart failed', err)
        }
      }, 250)
    }

    recRef.current = rec
    return rec
  }

  // start() must be called from a user gesture (tap).
  // It clears accumulated text and starts a fresh session.
  const start = useCallback(() => {
    if (!Recognition) return
    setError(null)
    setFinalText('')
    setInterim('')
    finalRef.current = ''
    wantListeningRef.current = true
    restartCountRef.current = 0

    const rec = ensureRec()
    if (isRunningRef.current) {
      // Already running (shouldn't normally happen on first tap) — abort so onend restarts
      try { rec.abort() } catch {}
    } else {
      try { rec.start() } catch (err) {
        console.warn('speech start failed', err)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // stop() signals "user is done" — no more auto-restarts.
  const stop = useCallback(() => {
    wantListeningRef.current = false
    restartCountRef.current = 0
    if (recRef.current && isRunningRef.current) {
      try { recRef.current.abort() } catch {}
    }
    // Set listening=false immediately so the UI reflects the change before onend fires
    setListening(false)
    setInterim('')
  }, [])

  const reset = useCallback(() => {
    setFinalText('')
    setInterim('')
    setError(null)
    finalRef.current = ''
  }, [])

  return { supported: speechSupported, listening, interim, finalText, start, stop, reset, error }
}
