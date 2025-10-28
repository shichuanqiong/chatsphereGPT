import { useEffect, useMemo, useState } from 'react';
import { getDatabase, onValue, ref, off } from 'firebase/database';
import { auth } from '../firebase';

export type Room = {
  id: string;
  name: string;
  isOfficial: boolean;
  visibility: 'public' | 'private';
  ownerId?: string;
  icon?: string;
};

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const uid = auth.currentUser?.uid || null;

  useEffect(() => {
    const db = getDatabase();
    const roomsRef = ref(db, 'rooms');
    const unsub = onValue(roomsRef, (snap) => {
      const raw = snap.val() || {};
      const list: Room[] = Object.entries<any>(raw).map(([id, v]) => ({
        id,
        name: v?.name ?? 'Unnamed Room',
        isOfficial: !!v?.isOfficial,
        visibility: (v?.visibility === 'private' ? 'private' : 'public'),
        ownerId: v?.ownerId,
        icon: v?.icon,
      }));
      setRooms(list);
    });
    return () => off(roomsRef, 'value', unsub);
  }, []);

  // 这里按你之前的样式：官方放一组，用户自建放一组
  const { officialRooms, userRooms } = useMemo(() => {
    const o = rooms.filter(r => r.isOfficial);
    const u = rooms.filter(r => !r.isOfficial);
    // 你也可以按成员过滤：只显示我能进/我加入的——这里保留全部，方便调试
    return { officialRooms: o, userRooms: u };
  }, [rooms]);

  return { officialRooms, userRooms, allRooms: rooms };
}
