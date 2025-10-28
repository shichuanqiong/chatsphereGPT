import { useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref, update, serverTimestamp, get } from 'firebase/database';

type Opt = { activeRoomId?: string | null; activeThreadId?: string | null };

// 进入会话时：将 lastReadTs 设置为最新一条消息的 ts，并把 unread 置 0
export async function markRoomRead(roomId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  
  try {
    const lastSnap = await get(ref(db, `messages/${roomId}`));
    const lastTs = (() => {
      if (!lastSnap.exists()) return Date.now();
      let max = 0;
      lastSnap.forEach((ch) => {
        const v = ch.val();
        if (v?.createdAt && v.createdAt > max) max = v.createdAt;
      });
      return max || Date.now();
    })();
    
    await update(ref(db), {
      [`roomsMeta/${uid}/${roomId}/lastReadTs`]: lastTs,
      [`roomsMeta/${uid}/${roomId}/roomId`]: roomId,
      [`roomsMeta/${uid}/${roomId}/unread`]: 0
    });
  } catch (e) {
    console.error('Failed to mark room as read:', e);
  }
}

export async function markThreadRead(threadId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  
  try {
    await update(ref(db, `dmThreads/${uid}/${threadId}`), {
      unread: 0,
      lastMsgTs: serverTimestamp()
    });
  } catch (e) {
    console.error('Failed to mark thread as read:', e);
  }
}

// 增加房间未读数（当收到新消息且不在当前房间时）
export async function incrementRoomUnread(roomId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid || !roomId) return;
  
  try {
    const metaRef = ref(db, `roomsMeta/${uid}/${roomId}`);
    const cur = await get(metaRef);
    const unread = (cur.exists() && cur.val()?.unread) || 0;
    await update(metaRef, {
      unread: unread + 1,
      roomId
    });
  } catch (e) {
    console.error('Failed to increment room unread:', e);
  }
}

// 增加 DM 未读数（当收到新消息且不在当前 DM 时）
export async function incrementThreadUnread(threadId: string, msgTs?: number) {
  const uid = auth.currentUser?.uid;
  if (!uid || !threadId) return;
  
  try {
    const tRef = ref(db, `dmThreads/${uid}/${threadId}`);
    const snap = await get(tRef);
    const cur = snap.exists() ? snap.val() : {};
    await update(tRef, {
      unread: (cur.unread || 0) + 1,
      lastMsgTs: msgTs || Date.now()
    });
  } catch (e) {
    console.error('Failed to increment thread unread:', e);
  }
}

// Inbox 一键已读（清空所有未读）
export async function markAllRead() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  
  try {
    // DM 清零
    const th = await get(ref(db, `dmThreads/${uid}`));
    if (th.exists()) {
      const ops: any = {};
      th.forEach((s) => {
        ops[`dmThreads/${uid}/${s.key}/unread`] = 0;
      });
      if (Object.keys(ops).length) await update(ref(db), ops);
    }
    
    // Rooms 清零
    const rm = await get(ref(db, `roomsMeta/${uid}`));
    if (rm.exists()) {
      const ops: any = {};
      rm.forEach((s) => {
        ops[`roomsMeta/${uid}/${s.key}/unread`] = 0;
      });
      if (Object.keys(ops).length) await update(ref(db), ops);
    }
  } catch (e) {
    console.error('Failed to mark all as read:', e);
  }
}

export function useReadState({ activeRoomId, activeThreadId }: Opt) {
  const uid = auth.currentUser?.uid || 'anon';
  
  // 当活跃房间改变时，标记已读
  useEffect(() => {
    if (activeRoomId) {
      markRoomRead(activeRoomId);
    }
  }, [activeRoomId]);
  
  useEffect(() => {
    if (activeThreadId) {
      markThreadRead(activeThreadId);
    }
  }, [activeThreadId]);
  
  return {
    markRoomRead,
    markThreadRead,
    incrementRoomUnread,
    incrementThreadUnread,
    markAllRead,
  };
}

