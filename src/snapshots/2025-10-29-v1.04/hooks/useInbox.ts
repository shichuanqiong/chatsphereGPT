import { useEffect, useState, useRef } from 'react';
import { ref, onChildAdded, onChildChanged, onChildRemoved, off, get, update, remove, onValue } from 'firebase/database';
import { db, auth } from '../firebase';
import { Sound } from '../lib/sound';

type InboxItem = {
  id: string;
  type: 'dm' | 'room_invite';
  unread: boolean;
  ts: number;
  count?: number;
  // DM fields
  peerId?: string;
  lastMsg?: string;
  lastSender?: string;
  // Room invite fields
  roomId?: string;
  inviterUid?: string;
  archived?: boolean;
};

export function useInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const uid = auth.currentUser?.uid;
  
  // 声音播放控制（防止重复 ding + 节流）
  const prevRef = useRef<number>(0);
  const prevDmRef = useRef<number>(0);
  const lastDingRef = useRef<number>(0);

  // 监听未读数变化并播放声音
  useEffect(() => {
    if (!uid) return;

    const inboxRef = ref(db, `inbox/${uid}`);
    const off = onValue(inboxRef, snap => {
      // 计算当前未读总数 + 仅DM未读数（用于播放提示音的边沿检测）
      let total = 0;
      let dmTotal = 0;
      if (snap.exists()) {
        snap.forEach(child => {
          const item = child.val();
          const isUnread = item.unread === true && item.archived !== true;
          if (!isUnread) return;
          if (item.type === 'dm') {
            const c = item.count || 1;
            total += c;
            dmTotal += c;
          } else if (item.type === 'room_invite') {
            total += 1;
          }
        });
      }

      // 未读总数用于后续 UI 统计（保持 prevRef 以便其他地方需要）
      const prev = prevRef.current;
      prevRef.current = total;

      // 仅当 DM 未读数上升时播放提示音（不再依赖 document.hidden）
      const prevDm = prevDmRef.current;
      const dmIncreased = dmTotal > prevDm;
      const now = Date.now();
      if (dmIncreased && now - lastDingRef.current > 1000) {
        Sound.play('ding');
        lastDingRef.current = now;
      }
      prevDmRef.current = dmTotal;
    });
    return () => off();
  }, [uid]);

  // 监听 inbox 项目变化（用于 UI 显示）
  useEffect(() => {
    if (!uid) return;

    const inboxRef = ref(db, `inbox/${uid}`);
    
    const handleAdd = (snap: any) => {
      const item = snap.val();
      const newItem: InboxItem = {
        id: snap.key!,
        type: item.type || 'dm',
        unread: item.unread || false,
        ts: item.ts || Date.now(),
        count: item.count || 1,
        peerId: item.peerId,
        lastMsg: item.lastMsg,
        lastSender: item.lastSender,
        roomId: item.roomId,
        inviterUid: item.inviterUid,
      };
      
      setItems(prev => {
        const filtered = prev.filter(i => i.id !== newItem.id);
        return [...filtered, newItem].sort((a, b) => b.ts - a.ts);
      });
    };

    const handleChange = (snap: any) => {
      const item = snap.val();
      setItems(prev => prev.map(i => {
        if (i.id === snap.key!) {
          return {
            ...i,
            unread: item.unread || false,
            archived: item.archived || false,
            ts: item.ts || i.ts,
            count: item.count || i.count,
            lastMsg: item.lastMsg ?? i.lastMsg,
            lastSender: item.lastSender ?? i.lastSender,
            peerId: item.peerId ?? i.peerId,
          };
        }
        return i;
      }));
    };

    const handleRemoved = (snap: any) => {
      const id = snap.key as string;
      setItems(prev => prev.filter(i => i.id !== id));
    };

    const addOff = onChildAdded(inboxRef, handleAdd);
    const changeOff = onChildChanged(inboxRef, handleChange);
    const removedOff = onChildRemoved(inboxRef, handleRemoved);

    return () => {
      addOff();
      changeOff();
      removedOff();
    };
  }, [uid]);

  // 计算未读数（用于 UI 显示）
  useEffect(() => {
    const total = items.reduce((sum, item) => {
      const isSupported = item.type === 'dm' || item.type === 'room_invite';
      if (!isSupported || item.unread !== true || item.archived === true) return sum;
      if (item.type === 'dm') return sum + (item.count || 1);
      return sum + 1; // room_invite 计 1 条
    }, 0);
    setUnreadCount(total);
  }, [items]);

  const markAsRead = async (itemId: string) => {
    if (!uid) return;
    const itemRef = ref(db, `inbox/${uid}/${itemId}`);
    const snap = await get(itemRef);
    if (!snap.exists()) return;
    
    const item = snap.val();
    const updates: Record<string, any> = { unread: false };
    
    // 对于DM类型，重置count为0
    if (item.type === 'dm') {
      updates.count = 0;
    }
    
    await update(itemRef, updates);
  };

  const markAllAsRead = async () => {
    if (!uid) return;
    const snap = await get(ref(db, `inbox/${uid}`));
    if (!snap.exists()) return;
    const updates: Record<string, any> = {};
    snap.forEach(ch => { 
      const item = ch.val();
      updates[`${ch.key}/unread`] = false;
      // 对于DM类型，重置count为0
      if (item.type === 'dm') {
        updates[`${ch.key}/count`] = 0;
      }
    });
    await update(ref(db, `inbox/${uid}`), updates);
  };

  const clearInbox = async () => {
    if (!uid) return;
    const snap = await get(ref(db, `inbox/${uid}`));
    if (!snap.exists()) return;
    const tasks: Promise<any>[] = [];
    snap.forEach(ch => {
      const v = ch.val();
      if (v && v.unread === false) tasks.push(remove(ref(db, `inbox/${uid}/${ch.key}`)));
    });
    await Promise.all(tasks);
  };

  return {
    items,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearInbox,
  };
}