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

// Firebase 配置 - 使用旧项目 chatspheregpt
const firebaseConfig = {
  apiKey: "AIzaSyD-M3CM2Y0o9TkuYoPX1ShjUd3zENviIGc",
  authDomain: "chatspheregpt.firebaseapp.com",
  databaseURL: "https://chatspheregpt-default-rtdb.firebaseio.com",
  projectId: "chatspheregpt",
  storageBucket: "chatspheregpt.firebasestorage.app",
  messagingSenderId: "421775686973",
  appId: "1:421775686973:web:c10b0c50f1af2759569954"
};

let app: any;
let initialized = false;

try {
  app = initializeApp(firebaseConfig);
  initialized = true;
  console.log('[Firebase] ✅ Initialized successfully');
} catch (err) {
  console.error('[Firebase] ❌ Initialization failed:', err);
  console.error('[Firebase] Make sure all VITE_FIREBASE_* env vars are set');
  // 显示友好的错误界面
  document.body.innerHTML = `
    <div style="
      color: #fff;
      background: #1a1a2e;
      padding: 24px;
      font-family: monospace;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="text-align: center; max-width: 500px;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">Firebase 初始化失败</div>
        <div style="font-size: 12px; color: #aaa; line-height: 1.6;">
          <div>请检查 GitHub Actions Secrets 中的 Firebase 配置。</div>
          <div>打开浏览器控制台查看详细错误信息。</div>
        </div>
      </div>
    </div>
  `;
}

// Auth - 仅在初始化成功时设置
export const auth = initialized ? getAuth(app) : null;

if (initialized && auth) {
  try {
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error('[Firebase] Persistence error:', err);
    });
  } catch (err) {
    console.error('[Firebase] setPersistence error:', err);
  }
}

// RTDB - 仅在初始化成功时设置
export const db = initialized ? getDatabase(app) : null;

/** ---------- Presence: 上线/心跳/下线 ---------- */

/** 首次上线或恢复登录时调用：写入在线状态 + onDisconnect 清理 */
export function presenceOnline(uid: string) {
  if (!db) {
    console.error('[Firebase] Database not initialized');
    return Promise.reject(new Error('Firebase not initialized'));
  }
  const pRef = ref(db, `/presence/${uid}`);
  try { onDisconnect(pRef).remove(); } catch {}
  return set(pRef, { state: 'online', lastSeen: serverTimestamp() });
}

/** 每 30s 心跳，返回停止函数 */
export function startPresenceHeartbeat(uid: string) {
  if (!db) {
    console.error('[Firebase] Database not initialized');
    return () => {};
  }
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
  if (!db) {
    console.error('[Firebase] Database not initialized');
    return Promise.reject(new Error('Firebase not initialized'));
  }
  const pRef = ref(db, `/presence/${uid}`);
  return set(pRef, { state: 'offline', lastSeen: serverTimestamp() });
}
