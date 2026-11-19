import { useState, useEffect } from 'react'
import { DEFAULT_ITEMS } from '../constants'

const STORAGE_KEY = 'aisle-items'
const LEARNED_KEY = 'aisle-learned'

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function useItems() {
  const [items, setItems] = useState(loadItems)

  useEffect(() => {
    saveItems(items)
  }, [items])

  function addItem({ name, store, category }) {
    setItems(prev => {
      const maxOrder = prev.length > 0 ? Math.max(...prev.map(i => i.order)) : -1
      return [
        ...prev,
        {
          id: Date.now().toString(),
          name,
          store,
          category,
          checked: false,
          order: maxOrder + 1,
          addedAt: Date.now(),
        },
      ]
    })
  }

  function toggleItem(id) {
    setItems(prev =>
      prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item)
    )
  }

  function removeItem(id) {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  function updateItemStore(id, newStore) {
    setItems(prev =>
      prev.map(item => item.id === id ? { ...item, store: newStore } : item)
    )
  }

  function reorderItems(newItems) {
    setItems(newItems.map((item, idx) => ({ ...item, order: idx })))
  }

  function moveStoreItems(fromStoreId, toStoreId) {
    setItems(prev =>
      prev.map(item =>
        item.store === fromStoreId
          ? { ...item, store: toStoreId, category: 'Other' }
          : item
      )
    )
  }

  function uncheckAll() {
    setItems(prev => prev.map(item => ({ ...item, checked: false })))
  }

  function clearAll() {
    setItems([])
  }

  function resetToDefaults() {
    localStorage.removeItem(LEARNED_KEY)
    const now = Date.now()
    setItems(DEFAULT_ITEMS.map((item, idx) => ({
      ...item,
      id: (now + idx).toString(),
      checked: false,
      order: idx,
    })))
  }

  function loadFromRemote(remoteItems) {
    if (!Array.isArray(remoteItems)) return
    // Normalize each item to ensure all rendered fields are primitives,
    // preventing React Error #130 if Supabase returns unexpected types.
    setItems(remoteItems.map((item, idx) => ({
      ...item,
      id: item?.id != null ? String(item.id) : String(Date.now() + idx),
      name: typeof item?.name === 'string' ? item.name : String(item?.name ?? ''),
      store: typeof item?.store === 'string' ? item.store : 'tjs',
      category: typeof item?.category === 'string' ? item.category : 'Pantry',
      checked: Boolean(item?.checked),
      order: typeof item?.order === 'number' ? item.order : idx,
    })))
  }

  return { items, addItem, toggleItem, removeItem, updateItemStore, reorderItems, moveStoreItems, uncheckAll, clearAll, resetToDefaults, loadFromRemote }
}
