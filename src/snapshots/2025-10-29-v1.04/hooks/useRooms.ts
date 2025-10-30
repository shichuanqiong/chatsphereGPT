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
  createdAt?: number;
  expiresAt?: number;
  type?: string;
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
        isOfficial: v?.type === 'official' || !!v?.isOfficial,
        visibility: (v?.visibility === 'private' ? 'private' : 'public'),
        ownerId: v?.ownerId,
        icon: v?.icon,
        createdAt: typeof v?.createdAt === 'number' ? v.createdAt : undefined,
        expiresAt: typeof v?.expiresAt === 'number' ? v.expiresAt : undefined,
        type: v?.type,
      }));
      setRooms(list);
    });
    return () => off(roomsRef, 'value', unsub);
  }, []);

  // 这里按你之前的样式：官方放一组，用户自建放一组
  const { officialRooms, userRooms } = useMemo(() => {
    const now = Date.now();
    const o = rooms.filter(r => r.isOfficial);
    const u = rooms
      .filter(r => !r.isOfficial && (!r.expiresAt || r.expiresAt > now))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // 新的在上
    return { officialRooms: o, userRooms: u };
  }, [rooms]);

  return { officialRooms, userRooms, allRooms: rooms };
}
