import { ref, onValue, update, get } from 'firebase/database';
import { db } from '../firebase';

const PROFILE_DEFAULTS = {
  nickname: '',
  age: '',
  country: '',
  gender: '',
  isGuest: false,
  createdAt: Date.now(),
  // ⚠️ 不给 bio 默认值，这样不会被覆盖
};

/**
 * Ensure profile exists with required fields, but don't overwrite existing data like bio
 * @param uid User ID
 */
export async function ensureProfile(uid: string) {
  const r = ref(db, `profiles/${uid}`);
  const snap = await get(r);

  const defaults = {
    ...PROFILE_DEFAULTS,
    createdAt: typeof PROFILE_DEFAULTS.createdAt === 'function' 
      ? PROFILE_DEFAULTS.createdAt() 
      : PROFILE_DEFAULTS.createdAt
  };

  if (!snap.exists()) {
    // 首次创建：用 update() 只写必要字段，不覆盖
    console.log('[PROFILE] ensure (create)', uid);
    await update(r, defaults);
    return;
  }

  // 已存在：只补缺，不动已有字段（尤其是 bio）
  const toPatch: Record<string, any> = {};
  Object.entries(defaults).forEach(([k, v]) => {
    // 如果这个子键不存在，才补上
    if (snap.child(k).val() === null) {
      toPatch[k] = v;
    }
  });

  if (Object.keys(toPatch).length > 0) {
    console.log('[PROFILE] ensure (patch)', uid, Object.keys(toPatch));
    await update(r, toPatch);
  } else {
    console.log('[PROFILE] ensure (skip)', uid, 'all fields exist');
  }
}

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
  console.log('[BIO] save', uid, `profiles/${uid}/bio`, bioClean.length);
  await update(ref(db, `profiles/${uid}`), {
    bio: bioClean,
    bioUpdatedAt: Date.now()
  });
}
