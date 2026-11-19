import { supabase } from './supabase'

export async function fetchUserData(userId) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('items, custom_stores, active_builtin_order, learned')
      .eq('user_id', userId)
      .single()
    if (error) return null
    return data
  } catch {
    return null
  }
}

export async function saveUserData(userId, { items, customStores, activeBuiltinOrder, learned }) {
  if (!supabase) return
  try {
    await supabase.from('user_data').upsert({
      user_id: userId,
      items,
      custom_stores: customStores,
      active_builtin_order: activeBuiltinOrder,
      learned,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // Supabase unavailable — localStorage fallback already in place
  }
}
