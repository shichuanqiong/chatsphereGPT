import { useCallback } from 'react';
import { createOrGetDMRoom } from '@/api/rooms';
import { auth, db } from '@/firebase';
import { ref as dbRef, set, serverTimestamp } from 'firebase/database';

type Peer = { id: string; nickname?: string; profile?: any };

type Options = {
  onOpened?: (roomId: string, peer: Peer) => void;
  closeSideSheet?: () => void;
  focusInput?: () => void;
};

export function useOpenDM({ onOpened, closeSideSheet, focusInput }: Options = {}) {
  return useCallback(
    async (peer: Peer): Promise<boolean> => {
      try {
        const { roomId } = await createOrGetDMRoom(peer.id);
        const uid = auth.currentUser?.uid;
        
        // 为当前用户创建 dmThread（允许后续读消息）
        if (uid) {
          try {
            await set(dbRef(db, `/dmThreads/${uid}/${roomId}`), {
              threadId: roomId,
              peerId: peer.id,
              lastMsg: '',
              lastSender: '',
              lastTs: serverTimestamp(),
              unread: 0,
            });
            console.log('[DM] 为当前用户创建 thread');
          } catch (err) {
            console.error('[DM] 创建 thread 失败（非关键）:', err);
          }
        }
        
        closeSideSheet?.();
        onOpened?.(roomId, peer);
        setTimeout(() => focusInput?.(), 120);
        return true;
      } catch (err) {
        console.error('Failed to open DM', err);
        return false;
      }
    },
    [closeSideSheet, focusInput, onOpened]
  );
}
