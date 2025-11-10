import { onValue, ref, remove, set } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";

export function useRoomBlocks(myUid: string | undefined, roomId: string | undefined) {
  const [map, setMap] = useState<Record<string, true>>({});

  useEffect(() => {
    if (!myUid) return;
    // v1.19-stable 没有房间级别的 block，使用全局 block（在房间中也适用）
    const r = ref(db, `blocks/${myUid}`);
    const off = onValue(r, (snap) => setMap((snap.val() as any) ?? {}));
    return () => off();
  }, [myUid]);

  const setBlocked = async (peerUid: string, blocked: boolean) => {
    if (!myUid || !roomId || myUid === peerUid) return;
    // v1.19-stable：使用全局 block 路径
    const path = ref(db, `blocks/${myUid}/${peerUid}`);
    blocked ? await set(path, true) : await remove(path);
  };

  const blockedSet = useMemo(() => new Set(Object.keys(map || {})), [map]);
  const isBlocked = (peerUid: string) => blockedSet.has(peerUid);

  return { blockedSet, isBlocked, setBlocked };
}

export function useGlobalBlocks(myUid: string | undefined) {
  const [map, setMap] = useState<Record<string, true>>({});

  useEffect(() => {
    if (!myUid) return;
    const r = ref(db, `blocks/${myUid}`);
    const off = onValue(r, (snap) => setMap((snap.val() as any) ?? {}));
    return () => off();
  }, [myUid]);

  const setBlocked = async (peerUid: string, blocked: boolean) => {
    if (!myUid || myUid === peerUid) return;
    const path = ref(db, `blocks/${myUid}/${peerUid}`);
    blocked ? await set(path, true) : await remove(path);
  };

  const blockedSet = useMemo(() => new Set(Object.keys(map || {})), [map]);
  const isBlocked = (peerUid: string) => blockedSet.has(peerUid);

  return { blockedSet, isBlocked, setBlocked };
}


