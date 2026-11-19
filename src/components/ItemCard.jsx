import { useState, useEffect, useRef } from 'react'
import { Check, Trash2 } from 'react-feather'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function GripDots() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none" style={{ color: 'var(--grip)' }}>
      <circle cx="3" cy="3"  r="1.5" fill="currentColor" />
      <circle cx="7" cy="3"  r="1.5" fill="currentColor" />
      <circle cx="3" cy="8"  r="1.5" fill="currentColor" />
      <circle cx="7" cy="8"  r="1.5" fill="currentColor" />
      <circle cx="3" cy="13" r="1.5" fill="currentColor" />
      <circle cx="7" cy="13" r="1.5" fill="currentColor" />
    </svg>
  )
}

const DELETE_BTN_WIDTH = 88
const MAX_SWIPE = -88
const THRESHOLD = -40

export default function ItemCard({
  item,
  onToggle,
  onDelete,
  onEdit,
  colors,
  full = false,
  isDraggable = false,
  isOverlay = false,
}) {
  const prevChecked = useRef(item.checked)
  const [showSpark, setShowSpark] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const [isTouching, setIsTouching] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isJustAdded = !!(item.addedAt && (Date.now() - item.addedAt < 600))

  const touchRef = useRef(null)
  const swipingRef = useRef(false)
  const cardRef = useRef(null)
  const swipeXRef = useRef(0)
  const isDraggingRef = useRef(false)
  const touchMoveHandlerRef = useRef(null)

  useEffect(() => { swipeXRef.current = swipeX }, [swipeX])

  useEffect(() => {
    if (item.checked && !prevChecked.current) {
      setShowSpark(true)
      const t = setTimeout(() => setShowSpark(false), 450)
      prevChecked.current = true
      return () => clearTimeout(t)
    }
    if (!item.checked) prevChecked.current = false
  }, [item.checked])

  const {
    attributes,
    listeners,
    setNodeRef: sortableSetNodeRef,
    transform: sortableTransform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id: item.id })

  const isDragging = !isOverlay && sortableIsDragging
  const setNodeRef = isOverlay ? () => {} : sortableSetNodeRef
  const transform = isOverlay ? null : sortableTransform

  useEffect(() => {
    isDraggingRef.current = isDragging
    if (isDragging) { setSwipeX(0); swipeXRef.current = 0 }
  }, [isDragging])

  useEffect(() => {
    function handleOtherOpen(e) {
      if (e.detail.itemId !== item.id) {
        setIsTouching(false)
        setSwipeX(0)
        swipeXRef.current = 0
      }
    }
    document.addEventListener('aisle-swipe-open', handleOtherOpen)
    return () => document.removeEventListener('aisle-swipe-open', handleOtherOpen)
  }, [item.id])

  touchMoveHandlerRef.current = function (e) {
    if (isDraggingRef.current) return
    if (!touchRef.current) return
    const dx = e.touches[0].clientX - touchRef.current.x
    const dy = e.touches[0].clientY - touchRef.current.y

    if (!swipingRef.current) {
      if (Math.abs(dy) > Math.abs(dx) + 3) return
      if (Math.abs(dx) < 5) return
      if (touchRef.current.startSwipe >= 0 && dx > 0) return
      swipingRef.current = true
      if (dx < 0) {
        document.dispatchEvent(new CustomEvent('aisle-swipe-open', { detail: { itemId: item.id } }))
      }
    }

    e.preventDefault()
    const target = Math.max(MAX_SWIPE, Math.min(0, touchRef.current.startSwipe + dx))
    setSwipeX(target)
    swipeXRef.current = target
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
    touchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      startSwipe: swipeXRef.current,
    }
    swipingRef.current = false
  }

  function handleTouchEnd(e) {
    if (!swipingRef.current) {
      setIsTouching(false)
      touchRef.current = null
      return
    }

    const endX = e.changedTouches?.[0]?.clientX
    const startX = touchRef.current?.x
    const deltaDir = (endX != null && startX != null) ? endX - startX : 0

    swipingRef.current = false
    touchRef.current = null
    setIsTouching(false)

    let snapped
    if (deltaDir > 0 && swipeXRef.current < 0) {
      snapped = 0
    } else {
      snapped = swipeXRef.current <= THRESHOLD ? MAX_SWIPE : 0
    }
    setSwipeX(snapped)
    swipeXRef.current = snapped
  }

  function handleDelete() {
    setIsDeleting(true)
    setTimeout(() => onDelete?.(item.id), 250)
  }

  const dndTransform = CSS.Transform.toString(transform) || ''
  const outerTransition = isDragging
    ? 'none'
    : [transition, 'opacity 350ms cubic-bezier(0.4,0,0.2,1)'].filter(Boolean).join(', ')

  const showDeleteBtn = swipeX < -10
  const ringColor = colors?.ring ?? 'var(--check-border)'
  const checkFill = colors?.checkFill ?? colors?.deep ?? 'var(--text)'
  const checkIcon = colors?.checkIcon ?? 'white'

  return (
    <div
      ref={setNodeRef}
      className="item-row"
      style={{
        position: 'relative',
        opacity: isDeleting ? 0 : isDragging ? 0 : 1,
        transform: dndTransform || undefined,
        transition: outerTransition,
        animation: isJustAdded ? 'springIn 350ms cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
      }}
    >
      {/* Delete panel */}
      {onDelete && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            right: 0, top: 0, bottom: 0,
            width: DELETE_BTN_WIDTH,
            backgroundColor: 'var(--danger-bg)',
            border: 'none',
            display: showDeleteBtn ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 0,
            gap: 2,
          }}
        >
          <Trash2 size={16} color="white" />
          <span style={{ color: 'white', fontSize: 14, fontWeight: 800 }}>Delete</span>
        </button>
      )}

      {/* Row — slides left over delete panel */}
      <div
        ref={cardRef}
        style={{
          position: 'relative',
          zIndex: 1,
          backgroundColor: 'var(--paper)',
          minHeight: full ? 56 : 48,
          display: 'flex',
          alignItems: 'center',
          transform: `translateX(${swipeX}px)`,
          transition: isTouching ? 'none' : 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {isDraggable && (
          <div
            style={{ paddingLeft: 12, paddingRight: 6, touchAction: 'none', cursor: 'grab', display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}
            {...attributes}
            {...listeners}
          >
            <GripDots />
          </div>
        )}

        {/* Checkbox + spark — LEFT side */}
        <div style={{ position: 'relative', flexShrink: 0, paddingLeft: isDraggable ? 0 : 16 }}>
          <button onClick={() => onToggle(item.id)} style={{ padding: '4px', display: 'flex' }}>
            <div
              style={{
                width: full ? 28 : 24, height: full ? 28 : 24, borderRadius: '50%',
                border: item.checked ? 'none' : `2px solid ${ringColor}`,
                backgroundColor: 'transparent',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {item.checked && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  '--fill-color': checkFill,
                  backgroundColor: checkFill,
                  animation: 'circularFill 350ms cubic-bezier(0.34,1.56,0.64,1) forwards',
                }} />
              )}
              {item.checked && (
                <span style={{
                  position: 'relative', zIndex: 1, display: 'inline-flex',
                  animation: 'checkPop 250ms cubic-bezier(0.34,1.56,0.64,1) 100ms both',
                }}>
                  <Check size={full ? 18 : 14} color={checkIcon} strokeWidth={3.4} />
                </span>
              )}
            </div>
          </button>

          {showSpark && (
            <span style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', fontSize: '18px',
              color: ringColor,
              animation: 'sparkFade 420ms ease-out forwards',
              lineHeight: 1,
            }}>✦</span>
          )}
        </div>

        {/* Name — tap opens edit */}
        <div
          style={{ flex: 1, padding: '0 14px 0 8px', minWidth: 0, cursor: onEdit ? 'pointer' : undefined }}
          onClick={() => onEdit?.(item)}
        >
          <span style={{
            color: item.checked ? 'var(--text-mid)' : 'var(--text)',
            fontSize: full ? 17 : 16,
            fontWeight: 600,
            textDecoration: item.checked ? 'line-through' : 'none',
            textDecorationColor: item.checked ? checkFill : undefined,
            textDecorationThickness: item.checked ? '1.5px' : undefined,
            lineHeight: 1.3,
          }}>
            {item.name}
          </span>
        </div>
      </div>
    </div>
  )
}
