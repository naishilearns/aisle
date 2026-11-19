import { useState, useEffect, useRef } from 'react'

export default function NudgeCard({ onAdd, onDismiss }) {
  const [swipeX, setSwipeX] = useState(0)
  const [isTouching, setIsTouching] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const touchRef = useRef(null)
  const swipingRef = useRef(false)
  const cardRef = useRef(null)
  const swipeXRef = useRef(0)
  const touchMoveHandlerRef = useRef(null)

  touchMoveHandlerRef.current = function (e) {
    if (!touchRef.current) return
    const dx = e.touches[0].clientX - touchRef.current.x
    const dy = e.touches[0].clientY - touchRef.current.y

    if (!swipingRef.current) {
      if (Math.abs(dy) > Math.abs(dx) + 3) return
      if (dx >= 0 || Math.abs(dx) < 5) return
      swipingRef.current = true
    }

    e.preventDefault()
    setSwipeX(Math.min(0, dx))
    swipeXRef.current = Math.min(0, dx)
  }

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    function handler(e) { touchMoveHandlerRef.current(e) }
    el.addEventListener('touchmove', handler, { passive: false })
    return () => el.removeEventListener('touchmove', handler)
  }, [])

  function handleTouchStart(e) {
    setIsTouching(true)
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    swipingRef.current = false
  }

  function handleTouchEnd() {
    setIsTouching(false)
    touchRef.current = null
    if (!swipingRef.current) { swipingRef.current = false; return }
    swipingRef.current = false

    if (swipeXRef.current < -60) {
      setIsLeaving(true)
      setSwipeX(-600)
      swipeXRef.current = -600
      setTimeout(() => onDismiss?.(), 300)
    } else {
      setSwipeX(0)
      swipeXRef.current = 0
    }
  }

  return (
    <div
      ref={cardRef}
      className="mx-5 mb-4 p-4 flex items-center gap-3"
      style={{
        borderRadius: '16px',
        backgroundColor: 'var(--nudge-bg)',
        border: '1px solid var(--border)',
        transform: `translateX(${swipeX}px)`,
        transition: (isTouching && !isLeaving) ? 'none' : 'transform 300ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease',
        opacity: isLeaving ? 0 : 1,
        touchAction: 'pan-y',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{ width: 36, height: 36, backgroundColor: 'rgba(255,107,157,0.12)' }}
      >
        <span style={{ fontSize: '18px', color: '#FF7BAC', lineHeight: 1 }}>✦</span>
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 500, margin: 0 }}>
          Low on protein this week
        </p>
        <p style={{ color: 'var(--text-mid)', fontSize: '12px', marginTop: 2, marginBottom: 0 }}>
          Add lentils to your list?
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold"
        style={{
          border: '1.5px solid #E09820',
          color: '#E09820',
          backgroundColor: 'transparent',
          fontSize: '12px',
        }}
      >
        + Add
      </button>
    </div>
  )
}
