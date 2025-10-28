import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

export function usePresence(uid: string | undefined): 'online' | 'offline' {
  const [state, setState] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    if (!uid) return;
    
    const presenceRef = ref(db, `presence/${uid}`);
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.state === 'online') {
        setState('online');
      } else {
        // 检查 lastSeen，如果 5 分钟内更新过也认为在线
        const lastSeen = data?.lastSeen;
        if (lastSeen) {
          const lastSeenMs = typeof lastSeen === 'number' ? lastSeen : lastSeen;
          const now = Date.now();
          const isRecent = now - lastSeenMs < 5 * 60 * 1000; // 5 分钟
          setState(isRecent ? 'online' : 'offline');
        } else {
          setState('offline');
        }
      }
    });

    return () => unsubscribe();
  }, [uid]);

  return state;
}

