import { useCallback } from 'react';
import { createOrGetDMRoom } from '@/api/rooms';

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

