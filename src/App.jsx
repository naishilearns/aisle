import { useState, useMemo, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CATEGORIES, CATEGORY_EMOJI, PROTEIN_KEYWORDS, STORES } from './constants'
import { useItems } from './hooks/useItems'
import { useStores } from './hooks/useStores'
import { saveLearnedAssignment, detectCategory, loadLearnedFromRemote } from './utils/storeDetection'
import { storeColors } from './utils/storeColors'
import { getOrCreateUserId } from './lib/userId'
import { fetchUserData, saveUserData } from './lib/sync'
import TabRow from './components/TabRow'
import ItemCard from './components/ItemCard'
import StoreCard from './components/StoreCard'
import Bag from './components/Bag'
import NudgeCard from './components/NudgeCard'
import AddSheet from './components/AddSheet'
import ManageStoresSheet from './components/ManageStoresSheet'
import ListenSheet from './components/ListenSheet'
import PrimaryButton from './components/PrimaryButton'
import { speechSupported } from './lib/speech'

function hasProtein(items) {
  return items.some(
    item => !item.checked && PROTEIN_KEYWORDS.some(kw => item.name.toLowerCase().includes(kw))
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function CategoryHeader({ category }) {
  return (
    <div style={{ padding: '12px 16px 4px' }}>
      <span style={{
        color: 'var(--text-mid)',
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
      }}>
        {category}
      </span>
    </div>
  )
}

// Always rendered to keep dnd-kit droppable registered; visually shown only when dragging
function EmptyDropZone({ storeId, storeColor, isDragActive }) {
  const { setNodeRef, isOver } = useDroppable({ id: `store-droppable-${storeId}` })

  if (!isDragActive) {
    // Keep droppable mounted with minimal height so dnd-kit can detect it
    return <div ref={setNodeRef} style={{ height: 1 }} />
  }

  return (
    <div ref={setNodeRef} className="px-5 pb-3">
      <div
        style={{
          height: 60,
          borderRadius: 12,
          border: `1.5px dashed ${isOver ? storeColor + 'BB' : storeColor + '40'}`,
          backgroundColor: isOver ? storeColor + '0D' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 150ms ease, background-color 150ms ease',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Drop here</span>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 32px 40px', textAlign: 'center' }}>
      <Bag size={230} wiggle />
      <h2 style={{ fontFamily: '"Dela Gothic One", sans-serif', fontSize: 26, color: 'var(--text)', margin: '8px 0 0', lineHeight: 1.1 }}>
        Nothing in the bag yet
      </h2>
      <p style={{ color: 'var(--text-mid)', fontSize: 15, fontWeight: 600, margin: '10px 0 0', lineHeight: 1.4 }}>
        Say your whole list, or add one item.<br />We'll sort it by store.
      </p>
      <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, margin: '16px 0 0' }}>
        Try: "milk, eggs and basmati rice"
      </p>
    </div>
  )
}

export default function App() {
  // ─── Theme ────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('aisle-theme') || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
    return saved
  })

  useEffect(() => {
    localStorage.setItem('aisle-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  // ─── State ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [addToast, setAddToast] = useState(null) // { itemName, storeName }
  const [listenOpen, setListenOpen] = useState(false)
  const addToastTimer = useRef(null)

  const { items, addItem, toggleItem, removeItem, updateItemStore, reorderItems, moveStoreItems, uncheckAll, clearAll, loadFromRemote: loadItemsFromRemote } = useItems()
  const { customStores, allStores, allStoreOrder, activeBuiltinOrder, addBuiltinStore, removeBuiltinStore, addCustomStore, removeCustomStore, reorderAllStores, loadFromRemote: loadStoresFromRemote } = useStores()

  // ─── Supabase sync ────────────────────────────────────────────────
  const userId = useRef(getOrCreateUserId())
  const syncTimeout = useRef(null)
  const initialFetchDone = useRef(false)

  useEffect(() => {
    fetchUserData(userId.current).then(remote => {
      initialFetchDone.current = true
      if (!remote) return
      loadItemsFromRemote(remote.items)
      loadStoresFromRemote({
        customStores: remote.custom_stores,
        activeBuiltinOrder: remote.active_builtin_order,
      })
      loadLearnedFromRemote(remote.learned)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialFetchDone.current) return
    clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => {
      const learned = JSON.parse(localStorage.getItem('aisle-learned') || '{}')
      saveUserData(userId.current, { items, customStores, activeBuiltinOrder, learned })
    }, 1500)
    return () => clearTimeout(syncTimeout.current)
  }, [items, customStores, activeBuiltinOrder])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  )

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1
      return a.order - b.order
    }),
    [items]
  )

  const showNudge = !nudgeDismissed && items.length >= 5 && !hasProtein(items)

  function showAddToast(itemName, storeName) {
    setAddToast({ itemName, storeName })
    clearTimeout(addToastTimer.current)
    addToastTimer.current = setTimeout(() => setAddToast(null), 2200)
  }

  function handleAddItem(item) {
    addItem(item)
    const storeName = allStores[item.store]?.fullName ?? item.store
    showAddToast(item.name, storeName)
  }

  function handleAddLentils() {
    // Only add to indian if it's in active stores, otherwise first active store
    const targetStore = allStoreOrder.includes('indian') ? 'indian' : allStoreOrder[0] || 'tjs'
    addItem({ name: 'Lentils', store: targetStore, category: 'Protein' })
  }

  function handleDragStart(event) {
    setActiveId(event.active.id)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const draggedItem = items.find(i => i.id === active.id)
    if (!draggedItem) return

    // Dropped onto an empty store section droppable
    if (typeof over.id === 'string' && over.id.startsWith('store-droppable-')) {
      const newStore = over.id.slice('store-droppable-'.length)
      if (allStoreOrder.includes(newStore) && draggedItem.store !== newStore) {
        saveLearnedAssignment(draggedItem.name, newStore)
        const newCategory = detectCategory(draggedItem.name, newStore)
        const allSorted = [...items].sort((a, b) => a.order - b.order)
        reorderItems(allSorted.map(item =>
          item.id === draggedItem.id
            ? { ...item, store: newStore, category: newCategory }
            : item
        ))
      }
      return
    }

    if (active.id === over.id) return

    const allSorted = [...items].sort((a, b) => a.order - b.order)
    const oldIndex = allSorted.findIndex(i => i.id === active.id)
    const newIndex = allSorted.findIndex(i => i.id === over.id)
    const overItem = allSorted[newIndex]

    let updatedItems = arrayMove(allSorted, oldIndex, newIndex)
    if (draggedItem.store !== overItem.store) {
      const newStore = overItem.store
      saveLearnedAssignment(draggedItem.name, newStore)
      const newCategory = detectCategory(draggedItem.name, newStore)
      updatedItems = updatedItems.map(item =>
        item.id === draggedItem.id
          ? { ...item, store: newStore, category: newCategory }
          : item
      )
    }

    reorderItems(updatedItems)
  }

  function handleRemoveBuiltinStore(storeId) {
    removeBuiltinStore(storeId)
    if (activeTab === storeId) setActiveTab('all')
  }

  function handleDeleteCustomStore(storeId) {
    const fallback = allStoreOrder.find(id => id !== storeId) || 'tjs'
    moveStoreItems(storeId, fallback)
    removeCustomStore(storeId)
    if (activeTab === storeId) setActiveTab('all')
  }

  function handleConfirm() {
    if (confirmDialog === 'clearAll') clearAll()
    setConfirmDialog(null)
  }

  const activeItem = activeId ? items.find(i => i.id === activeId) : null

  // --- ALL TAB ---
  function renderAllTab() {
    const groups = allStoreOrder.map(storeId => ({
      storeId,
      items: sortedItems.filter(i => i.store === storeId),
    }))

    const isDragActive = activeId !== null
    const hasAnyItems = items.length > 0

    return (
      <>
        {!hasAnyItems ? (
          <EmptyState />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedItems.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {showNudge && <NudgeCard onAdd={handleAddLentils} onDismiss={() => setNudgeDismissed(true)} />}

              <div className="px-5 pt-2">
                {groups.map(({ storeId, items: groupItems }, index) => {
                  const hasItems = groupItems.length > 0
                  const store = allStores[storeId]
                  const colors = storeColors(store?.color ?? '#888', theme)

                  if (!hasItems && !isDragActive) {
                    return <EmptyDropZone key={storeId} storeId={storeId} storeColor={colors.ring} isDragActive={isDragActive} />
                  }

                  return (
                    <div
                      key={storeId}
                      style={{ animation: `staggerIn 300ms ease ${index * 50}ms both` }}
                    >
                      {hasItems ? (
                        <StoreCard store={store} colors={colors} tilt={index}>
                          {groupItems.map(item => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              onToggle={toggleItem}
                              onDelete={removeItem}
                              colors={colors}
                              isDraggable
                            />
                          ))}
                        </StoreCard>
                      ) : (
                        <EmptyDropZone storeId={storeId} storeColor={colors.ring} isDragActive={isDragActive} />
                      )}
                    </div>
                  )
                })}
              </div>

            </SortableContext>

            <DragOverlay>
              {activeItem && (() => {
                const overlayColors = storeColors(allStores[activeItem.store]?.color ?? '#888', theme)
                return (
                  <div style={{ transform: 'scale(1.03)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', borderRadius: 8, background: 'var(--paper)', overflow: 'hidden' }}>
                    <ItemCard
                      item={activeItem}
                      onToggle={() => {}}
                      colors={overlayColors}
                      isDraggable
                      isOverlay
                    />
                  </div>
                )
              })()}
            </DragOverlay>
          </DndContext>
        )}
      </>
    )
  }

  // --- STORE TAB ---
  function renderStoreTab(storeId) {
    const storeItems = sortedItems.filter(i => i.store === storeId)
    const store = allStores[storeId]
    const colors = storeColors(store?.color ?? '#888', theme)
    const categories = CATEGORIES[storeId] || []

    const grouped = categories.map(cat => ({
      category: cat,
      items: storeItems.filter(i => i.category === cat),
    })).filter(g => g.items.length > 0)

    const categorized = new Set(grouped.flatMap(g => g.items.map(i => i.id)))
    const other = storeItems.filter(i => !categorized.has(i.id))
    if (other.length > 0) grouped.push({ category: 'Other', items: other })

    if (grouped.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center mt-20 px-8 text-center">
          <p style={{ color: 'var(--no-items-text1)', fontSize: '14px' }}>
            No items for {store?.fullName ?? storeId} yet
          </p>
          <p style={{ color: 'var(--no-items-text2)', fontSize: '12px', marginTop: 4 }}>
            Add something using the button below
          </p>
        </div>
      )
    }

    const checkedCount = storeItems.filter(i => i.checked).length
    const Progress = () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Bag size={36} full={false} />
        <span style={{ color: 'white', fontSize: 13, fontWeight: 800 }}>
          {checkedCount} of {storeItems.length}
        </span>
      </div>
    )

    const nextStore = allStoreOrder.find(id => id !== storeId && sortedItems.some(i => i.store === id && !i.checked))
    const nextStoreData = nextStore ? allStores[nextStore] : null

    return (
      <div className="px-5 pt-2">
        <StoreCard full store={store} colors={colors} tilt={0} right={<Progress />}>
          {grouped.map(({ category, items: catItems }) => (
            <div key={category}>
              <CategoryHeader category={category} />
              {catItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onToggle={toggleItem}
                  onDelete={removeItem}
                  colors={colors}
                  full
                />
              ))}
            </div>
          ))}
        </StoreCard>

        {nextStoreData && (() => {
          const nextUncheckedCount = sortedItems.filter(i => i.store === nextStore && !i.checked).length
          return (
            <button
              onClick={() => setActiveTab(nextStore)}
              style={{
                width: '100%',
                height: 56,
                borderRadius: 28,
                border: '1.5px dashed var(--divider-strong)',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 18px',
                cursor: 'pointer',
                marginTop: 4,
                marginBottom: 8,
                boxSizing: 'border-box',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: 'var(--text-mid)', fontSize: 14, fontWeight: 700 }}>
                Next stop
              </span>
              <span style={{ flex: 1, color: 'var(--text)', fontSize: 14, fontWeight: 800, textAlign: 'left' }}>
                {nextStoreData.fullName} · {nextUncheckedCount} {nextUncheckedCount === 1 ? 'item' : 'items'}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-mid)' }}>
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
          )
        })()}
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      {/* Safe area top */}
      <div style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between">
          <div>
            <p style={{ color: 'var(--text-mid)', fontSize: 13, fontWeight: 700, margin: '0 0 6px', fontFamily: '"Plus Jakarta Sans", sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
              {getGreeting()}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M12 2c.6 4.6 2.4 7.4 10 10-7.6 2.6-9.4 5.4-10 10-.6-4.6-2.4-7.4-10-10 7.6-2.6 9.4-5.4 10-10z"/>
              </svg>
            </p>
            <h1
              style={{
                fontFamily: '"Dela Gothic One", sans-serif',
                fontSize: '32px',
                color: 'var(--text)',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              Grocery List
            </h1>
          </div>

          <div style={{ position: 'relative', marginTop: 4 }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: menuOpen ? 'var(--text)' : 'var(--surface)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: menuOpen ? 'var(--bg)' : 'var(--menu-icon)',
                boxShadow: menuOpen ? 'none' : 'var(--shadow-card)',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="5" r="1.8" fill="currentColor"/>
                <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
                <circle cx="12" cy="19" r="1.8" fill="currentColor"/>
              </svg>
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0"
                  style={{ zIndex: 49 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 4px)',
                    zIndex: 50,
                    backgroundColor: 'var(--menu-bg)',
                    borderRadius: 24,
                    width: 236,
                    padding: 8,
                    boxSizing: 'border-box',
                    boxShadow: '0 18px 40px rgba(0,0,0,.3)',
                  }}
                >
                  <button
                    onClick={() => { setMenuOpen(false); toggleTheme() }}
                    style={{
                      width: '100%', height: 50, border: 0, borderRadius: 14,
                      background: 'transparent', display: 'flex', alignItems: 'center',
                      gap: 14, padding: '0 14px', textAlign: 'left',
                      font: '700 15px "Plus Jakarta Sans",sans-serif',
                      color: 'var(--text)', cursor: 'pointer',
                    }}
                  >
                    {theme === 'dark' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>
                      </svg>
                    )}
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </button>
                  <button
                    disabled={items.length === 0}
                    onClick={() => { setMenuOpen(false); uncheckAll() }}
                    style={{
                      width: '100%', height: 50, border: 0, borderRadius: 14,
                      background: 'transparent', display: 'flex', alignItems: 'center',
                      gap: 14, padding: '0 14px', textAlign: 'left',
                      font: '700 15px "Plus Jakarta Sans",sans-serif',
                      color: 'var(--text)', cursor: items.length === 0 ? 'default' : 'pointer',
                      opacity: items.length === 0 ? 0.35 : 1,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>
                    </svg>
                    Uncheck all
                  </button>
                  <button
                    disabled={items.length === 0}
                    onClick={() => { setMenuOpen(false); setConfirmDialog('clearAll') }}
                    style={{
                      width: '100%', height: 50, border: 0, borderRadius: 14,
                      background: 'transparent', display: 'flex', alignItems: 'center',
                      gap: 14, padding: '0 14px', textAlign: 'left',
                      font: '700 15px "Plus Jakarta Sans",sans-serif',
                      color: 'var(--danger)', cursor: items.length === 0 ? 'default' : 'pointer',
                      opacity: items.length === 0 ? 0.35 : 1,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>
                    </svg>
                    Clear all items
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="pb-3">
          <TabRow
            activeTab={activeTab}
            onTabChange={setActiveTab}
            allStores={allStores}
            allStoreOrder={allStoreOrder}
            onOpenSettings={() => setManageOpen(true)}
            theme={theme}
          />
        </div>
      </div>

      {/* Success toast — below header, slides down */}
      {addToast && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 150,
            pointerEvents: 'none',
            paddingTop: 'calc(env(safe-area-inset-top, 44px) + 108px)',
            padding: 'calc(env(safe-area-inset-top, 44px) + 108px) 16px 0',
          }}
        >
          <div
            style={{
              backgroundColor: '#2A2420',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'toastIn 200ms ease-out, toastOut 200ms ease-in 1.8s forwards',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ color: '#FF7BAC', fontSize: 13, flexShrink: 0 }}>✦</span>
            <span style={{ color: '#F0EBE0', fontSize: 13, fontWeight: 600 }}>{addToast.itemName}</span>
            <span style={{ color: 'rgba(240,235,224,0.5)', fontSize: 13 }}>added to {addToast.storeName}</span>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-36">
        <div
          key={activeTab}
          style={{ animation: 'fadeIn 150ms ease forwards' }}
        >
          {activeTab === 'all' && renderAllTab()}
          {activeTab !== 'all' && renderStoreTab(activeTab)}
        </div>
      </div>

      {/* Bottom bar: Add item + mic */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          boxSizing: 'border-box',
          padding: '34px 20px 0',
          paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))',
          background: 'var(--grad-bottom)',
          display: 'flex',
          gap: 12,
        }}
      >
        <PrimaryButton
          onClick={() => setSheetOpen(true)}
          style={{ flex: 1, height: 58, borderRadius: 29 }}
        >
          Add item
        </PrimaryButton>
        {speechSupported && (
          <button
            aria-label="Dictate a list"
            onClick={() => setListenOpen(true)}
            style={{
              flexShrink: 0,
              width: 58,
              height: 58,
              borderRadius: 29,
              background: 'var(--mic-bg)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)',
              cursor: 'pointer',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF7BAC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="12" rx="3"/>
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>
            </svg>
          </button>
        )}
      </div>

      {/* Listen Sheet */}
      <ListenSheet
        open={listenOpen}
        onClose={() => setListenOpen(false)}
        onDone={({ rawText, items }) => {
          // Part (c) will open ReviewSheet here; for now just close
          setListenOpen(false)
        }}
        allStores={allStores}
        allStoreOrder={allStoreOrder}
        theme={theme}
      />

      {/* Add Sheet */}
      <AddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={handleAddItem}
        items={items}
        allStores={allStores}
        allStoreOrder={allStoreOrder}
        theme={theme}
      />

      {/* Manage Stores Sheet */}
      <ManageStoresSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        customStores={customStores}
        allStores={allStores}
        allStoreOrder={allStoreOrder}
        activeBuiltinOrder={activeBuiltinOrder}
        onAddBuiltin={addBuiltinStore}
        onRemoveBuiltin={handleRemoveBuiltinStore}
        onAddCustom={name => addCustomStore(name)}
        onDeleteCustom={id => handleDeleteCustomStore(id)}
        onReorderStores={reorderAllStores}
        theme={theme}
      />

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ backgroundColor: 'var(--overlay)', backdropFilter: 'blur(4px)', zIndex: 200 }}
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="w-full max-w-xs p-6"
            style={{
              borderRadius: '20px',
              backgroundColor: 'var(--dialog-bg)',
              border: '1px solid var(--dialog-border)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: 'var(--text)', fontSize: '17px', fontWeight: 600, margin: '0 0 8px' }}>
              Delete all items?
            </h3>
            <p style={{ color: 'var(--text-mid)', fontSize: '14px', lineHeight: 1.4, margin: '0 0 20px' }}>
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '16px',
                  backgroundColor: 'var(--cancel-bg)', color: 'var(--cancel-text)',
                  border: '1px solid var(--cancel-border)', fontSize: '15px',
                  fontWeight: 500, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1, padding: '12px', borderRadius: '16px',
                  backgroundColor: 'var(--danger-bg)', color: '#FFFFFF', border: 'none',
                  fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

