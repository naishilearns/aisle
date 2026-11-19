import { useState, useEffect, useMemo } from 'react'
import { STORES, STORE_ORDER } from '../constants'

const CUSTOM_STORES_KEY = 'aisle-custom-stores'
const ACTIVE_BUILTIN_KEY = 'aisle-active-stores'

const PRESET_COLORS = [
  '#1E8449', '#C62A29', '#7A3FB5', '#2E7CA8',
  '#C4500F', '#0E7C86', '#A3246E', '#3B4BB8',
  '#5F7312', '#946200', '#8A4B2A', '#4A5A6A',
]

function loadCustomStores() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_STORES_KEY) || '[]')
  } catch {
    return []
  }
}

function loadActiveBuiltinOrder() {
  try {
    const stored = localStorage.getItem(ACTIVE_BUILTIN_KEY)
    if (stored) return JSON.parse(stored)
    return [...STORE_ORDER]
  } catch {
    return [...STORE_ORDER]
  }
}

export function useStores() {
  const [customStores, setCustomStores] = useState(loadCustomStores)
  const [activeBuiltinOrder, setActiveBuiltinOrder] = useState(loadActiveBuiltinOrder)

  useEffect(() => {
    localStorage.setItem(CUSTOM_STORES_KEY, JSON.stringify(customStores))
  }, [customStores])

  useEffect(() => {
    localStorage.setItem(ACTIVE_BUILTIN_KEY, JSON.stringify(activeBuiltinOrder))
  }, [activeBuiltinOrder])

  // allStores contains ALL builtin + custom stores for lookup (item colors, etc.)
  const allStores = useMemo(() => ({
    ...STORES,
    ...Object.fromEntries(customStores.map(s => [s.id, s])),
  }), [customStores])

  // allStoreOrder is what's actually shown in the UI
  const allStoreOrder = useMemo(() => [
    ...activeBuiltinOrder,
    ...customStores.map(s => s.id),
  ], [activeBuiltinOrder, customStores])

  function addBuiltinStore(storeId) {
    if (!STORES[storeId]) return
    setActiveBuiltinOrder(prev => prev.includes(storeId) ? prev : [...prev, storeId])
  }

  function removeBuiltinStore(storeId) {
    setActiveBuiltinOrder(prev => prev.filter(id => id !== storeId))
  }

  function addCustomStore(name) {
    const slug = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const id = (slug || 'store') + '_' + Date.now()
    const color = PRESET_COLORS[customStores.length % PRESET_COLORS.length]
    const store = {
      id,
      label: name.length > 12 ? name.slice(0, 12) : name,
      fullName: name,
      color,
      emoji: '🏬',
      custom: true,
    }
    setCustomStores(prev => [...prev, store])
    return id
  }

  function removeCustomStore(id) {
    setCustomStores(prev => prev.filter(s => s.id !== id))
  }

  function reorderAllStores(newOrder) {
    setActiveBuiltinOrder(newOrder.filter(id => STORES[id]))
    const newCustomOrder = newOrder.filter(id => !STORES[id])
    setCustomStores(prev => {
      const lookup = Object.fromEntries(prev.map(s => [s.id, s]))
      return newCustomOrder.map(id => lookup[id]).filter(Boolean)
    })
  }

  function loadFromRemote({ customStores: cs, activeBuiltinOrder: abo }) {
    if (Array.isArray(cs)) {
      // Only accept well-formed store objects to avoid rendering non-string fields
      setCustomStores(cs.filter(s => s && typeof s.id === 'string' && typeof s.label === 'string'))
    }
    if (Array.isArray(abo)) {
      setActiveBuiltinOrder(abo.filter(id => typeof id === 'string'))
    }
  }

  return {
    customStores,
    allStores,
    allStoreOrder,
    activeBuiltinOrder,
    addBuiltinStore,
    removeBuiltinStore,
    addCustomStore,
    removeCustomStore,
    reorderAllStores,
    loadFromRemote,
  }
}
