// src/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  update,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database';

// 从 .env 读取
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

// RTDB
export const db = getDatabase(app);

/** ---------- Presence: 上线/心跳/下线 ---------- */

/** 首次上线或恢复登录时调用：写入在线状态 + onDisconnect 清理 */
export function presenceOnline(uid: string) {
  const pRef = ref(db, `/presence/${uid}`);
  try { onDisconnect(pRef).remove(); } catch {}
  return set(pRef, { state: 'online', lastSeen: serverTimestamp() });
}

/** 每 30s 心跳，返回停止函数 */
export function startPresenceHeartbeat(uid: string) {
  const pRef = ref(db, `/presence/${uid}`);
  const tick = () => update(pRef, { lastSeen: serverTimestamp(), state: 'online' });
  tick(); // 立即打一针
  const timer = setInterval(tick, 30 * 1000);
  const beforeUnload = () => { try { navigator.sendBeacon?.('/', new Blob()); } catch {} };
  window.addEventListener('beforeunload', beforeUnload);
  return () => { clearInterval(timer); window.removeEventListener('beforeunload', beforeUnload); };
}

/** 可选：主动标记离线 */
export function presenceOffline(uid: string) {
  const pRef = ref(db, `/presence/${uid}`);
  return set(pRef, { state: 'offline', lastSeen: serverTimestamp() });
}
