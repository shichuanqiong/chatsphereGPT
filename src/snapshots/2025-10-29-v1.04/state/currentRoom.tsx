import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

type Ctx = {
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
};

const CurrentRoomCtx = createContext<Ctx | null>(null);

export function CurrentRoomProvider({ children }: { children: ReactNode }) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const value = useMemo(() => ({ activeRoomId, setActiveRoomId }), [activeRoomId]);
  return <CurrentRoomCtx.Provider value={value}>{children}</CurrentRoomCtx.Provider>;
}

export function useCurrentRoom() {
  const v = useContext(CurrentRoomCtx);
  if (!v) throw new Error('useCurrentRoom must be used within CurrentRoomProvider');
  return v;
}
