import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';

/**
 * Subscribe to user profile updates in real-time
 * @param uid User ID
 * @param cb Callback with profile data
 * @returns Unsubscribe function
 */
export function subscribeProfile(uid: string, cb: (profile: any) => void) {
  const r = ref(db, `profiles/${uid}`);
  return onValue(r, (snap) => cb(snap.val() || {}));
}

/**
 * Save Bio to Firebase RTDB
 * @param uid User ID
 * @param bio Bio text (will be trimmed)
 */
export async function saveBio(uid: string, bio: string) {
  const bioClean = (bio ?? '').trim();
  await update(ref(db, `profiles/${uid}`), {
    bio: bioClean,
    bioUpdatedAt: Date.now()
  });
}
