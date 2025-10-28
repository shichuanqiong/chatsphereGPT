import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db, auth } from '../firebase';

export function useFriends() {
  const [set_, setSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const r = ref(db, `friends/${uid}`);
    const unsub = onValue(r, (snap) => {
      const S = new Set<string>();
      snap.forEach(ch => {
        if (ch.val()) S.add(ch.key as string);
      });
      setSet(S);
    });

    return () => off(r, 'value', unsub as any);
  }, []);

  return set_;
}

