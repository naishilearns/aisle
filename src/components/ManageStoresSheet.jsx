import { useState, useRef, useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { STORES } from '../constants'
import { storeColors } from '../utils/storeColors'

const DELETE_WIDTH = 88
const MAX_SWIPE = -88
const THRESHOLD = -40

function GripDots() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true"
      style={{ flex: 'none', color: 'var(--text-mid)' }}>
      <circle cx="3" cy="3" r="1.6"/><circle cx="9" cy="3" r="1.6"/>
      <circle cx="3" cy="9" r="1.6"/><circle cx="9" cy="9" r="1.6"/>
      <circle cx="3" cy="15" r="1.6"/><circle cx="9" cy="15" r="1.6"/>
    </svg>
  )
}

function StoreRow({ store, onDelete, theme }) {
  const [swipeX, setSwipeX] = useState(0)
  const [isTouching, setIsTouching] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const touchRef = useRef(null)
  const swipingRef = useRef(false)
  const cardRef = useRef(null)
  const swipeXRef = useRef(0)
  const isDraggingRef = useRef(false)
  const touchMoveHandlerRef = useRef(null)

  useEffect(() => { swipeXRef.current = swipeX }, [swipeX])

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: store.id })

  useEffect(() => {
    isDraggingRef.current = isDragging
    if (isDragging) { setSwipeX(0); swipeXRef.current = 0 }
  }, [isDragging])

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
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, startSwipe: swipeXRef.current }
    swipingRef.current = false
  }

  function handleTouchEnd(e) {
    if (!swipingRef.current) {
      setIsTouching(false); touchRef.current = null; return
    }
    const endX = e.changedTouches?.[0]?.clientX
    const startX = touchRef.current?.x
    const deltaDir = (endX != null && startX != null) ? endX - startX : 0
    swipingRef.current = false; touchRef.current = null; setIsTouching(false)
    const snapped = deltaDir > 0 && swipeXRef.current < 0 ? 0 : swipeXRef.current <= THRESHOLD ? MAX_SWIPE : 0
    setSwipeX(snapped); swipeXRef.current = snapped
  }

  function handleDelete() {
    setIsDeleting(true)
    setTimeout(() => onDelete(store.id), 250)
  }

  const colors = storeColors(store.color, theme)
  const dndTransform = CSS.Transform.toString(transform) || ''

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        opacity: isDeleting ? 0 : 1,
        transform: dndTransform || undefined,
        transition: isDragging ? 'none' : [transition, 'opacity 350ms ease'].filter(Boolean).join(', '),
      }}
    >
      {/* Delete panel */}
      <button
        onClick={handleDelete}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: DELETE_WIDTH, border: 'none',
          backgroundColor: 'var(--danger-bg)', color: '#FFFFFF',
          display: swipeX < -10 ? 'flex' : 'none',
          alignItems: 'center', justifyContent: 'center',
          font: '800 14px "Plus Jakarta Sans",sans-serif',
          cursor: 'pointer', zIndex: 0,
        }}
      >
        Delete
      </button>

      {/* Row */}
      <div
        ref={cardRef}
        style={{
          position: 'relative', zIndex: 1,
          backgroundColor: 'var(--sheet-bg)',
          display: 'flex', alignItems: 'center', gap: 14,
          height: 56, padding: '0 4px',
          borderBottom: '1px solid var(--divider)',
          transform: `translateX(${swipeX}px)`,
          transition: isTouching ? 'none' : 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
          {...attributes}
          {...listeners}
        >
          <GripDots />
        </div>
        <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.ring, display: 'inline-block' }} />
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
          {store.fullName}
        </span>
      </div>
    </div>
  )
}

export default function ManageStoresSheet({
  open,
  onClose,
  customStores,
  allStores,
  allStoreOrder,
  activeBuiltinOrder,
  onAddBuiltin,
  onRemoveBuiltin,
  onAddCustom,
  onDeleteCustom,
  onReorderStores,
  theme = 'dark',
}) {
  const [newName, setNewName] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setNewName('')
      setAddOpen(false)
    }
  }, [open])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = allStoreOrder.indexOf(active.id)
    const newIndex = allStoreOrder.indexOf(over.id)
    onReorderStores(arrayMove([...allStoreOrder], oldIndex, newIndex))
  }

  function handleDelete(id) {
    if (customStores.some(s => s.id === id)) {
      onDeleteCustom(id)
    } else {
      onRemoveBuiltin(id)
    }
  }

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    onAddCustom(name)
    setNewName('')
    setAddOpen(false)
  }

  const inactiveBuiltins = Object.keys(STORES).filter(id => !activeBuiltinOrder.includes(id))

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'var(--overlay)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          borderRadius: '32px 32px 0 0',
          backgroundColor: 'var(--sheet-bg)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          paddingBottom: 34,
          animation: 'slideUpTransformOnly 350ms cubic-bezier(0.34,1.56,0.64,1) forwards',
          maxHeight: '75vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'var(--drag-handle)', marginBottom: 18 }} />
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Stores</p>
            <button
              onClick={onClose}
              style={{
                height: 44, padding: '0 4px', border: 0, background: 'transparent',
                color: 'var(--text)', font: '800 15px "Plus Jakarta Sans",sans-serif', cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>

          {/* Sortable store list */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={allStoreOrder} strategy={verticalListSortingStrategy}>
              <div style={{ margin: '0 -20px', padding: '0 20px', overflow: 'hidden' }}>
                {allStoreOrder.map(id => {
                  const store = allStores[id]
                  if (!store) return null
                  return (
                    <StoreRow key={id} store={store} onDelete={handleDelete} theme={theme} />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>

          {/* "+ Add a store" button or expanded form */}
          {!addOpen ? (
            <button
              onClick={() => { setAddOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
              style={{
                marginTop: 16, width: '100%', height: 56, borderRadius: 18,
                border: '1.5px dashed var(--input-border)',
                background: 'transparent', color: '#FF7BAC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, font: '800 15px "Plus Jakarta Sans",sans-serif', cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add a store
            </button>
          ) : (
            <div style={{ marginTop: 16 }}>
              {/* Custom store name input */}
              <div style={{
                height: 56, borderRadius: 18, border: '1.5px solid var(--input-border)',
                display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 0 16px',
                marginBottom: 12,
              }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="Store name…"
                  className="bg-transparent outline-none"
                  style={{
                    flex: 1, fontSize: 16, fontWeight: 600,
                    color: newName ? 'var(--input-color)' : 'var(--text-mid)',
                    caretColor: 'var(--caret)', border: 'none', padding: 0,
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  style={{
                    height: 40, padding: '0 16px', borderRadius: 20, border: 'none',
                    background: newName.trim() ? 'var(--add-btn-bg)' : 'var(--cancel-bg)',
                    color: newName.trim() ? 'var(--add-btn-text)' : 'var(--text-lo)',
                    fontSize: 13, fontWeight: 800,
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    cursor: newName.trim() ? 'pointer' : 'default',
                  }}
                >
                  Add
                </button>
              </div>

              {/* Inactive builtin stores to re-add */}
              {inactiveBuiltins.length > 0 && (
                <div>
                  {inactiveBuiltins.map(id => {
                    const store = STORES[id]
                    if (!store) return null
                    const colors = storeColors(store.color, theme)
                    return (
                      <div
                        key={id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          height: 56, padding: '0 4px',
                          borderBottom: '1px solid var(--divider)',
                          opacity: 0.65,
                        }}
                      >
                        <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.ring, display: 'inline-block' }} />
                        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{store.fullName}</span>
                        <button
                          onClick={() => onAddBuiltin(id)}
                          style={{
                            height: 36, padding: '0 14px', borderRadius: 18, border: 'none',
                            backgroundColor: colors.ring, color: '#FFFFFF',
                            fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            fontFamily: '"Plus Jakarta Sans", sans-serif',
                          }}
                        >
                          Add
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Cancel */}
              <button
                onClick={() => { setAddOpen(false); setNewName('') }}
                style={{
                  marginTop: 12, width: '100%', height: 44, borderRadius: 22, border: 'none',
                  background: 'var(--cancel-bg)', color: 'var(--text-mid)',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Hint */}
          <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-mid)' }}>
            Drag to reorder. Swipe left to delete.
          </p>
        </div>
      </div>
    </>
  )
}
