import { getDatabase, ref, onValue } from 'firebase/database'

export type ProfilesMap = Record<string, { nickname?: string; avatar?: string; age?: number; gender?: string; country?: string }>

/**
 * Subscribe to all profiles from RTDB
 * Returns unsubscribe function
 */
export function subscribeProfiles(cb: (profiles: ProfilesMap) => void) {
  try {
    const db = getDatabase()
    if (!db) {
      console.warn('[profileStore] Database not initialized')
      cb({})
      return () => {}
    }
    
    const r = ref(db, 'profiles')
    
    return onValue(r, snap => {
      const data = (snap.val() || {}) as ProfilesMap
      cb(data)
    }, err => {
      console.warn('[profileStore] Profiles sync error:', err.message)
      // Fallback to empty map on error
      cb({})
    })
  } catch (err) {
    console.error('[profileStore] Subscribe error:', err)
    cb({})
    return () => {}
  }
}
