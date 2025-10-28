import { onValue, ref, remove, set } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";

export function useRoomBlocks(myUid: string | undefined, roomId: string | undefined) {
  const [map, setMap] = useState<Record<string, true>>({});

  useEffect(() => {
    if (!myUid || !roomId) return;
    const r = ref(db, `userBlocks/${myUid}/rooms/${roomId}`);
    const off = onValue(r, (snap) => setMap((snap.val() as any) ?? {}));
    return () => off();
  }, [myUid, roomId]);

  const setBlocked = async (peerUid: string, blocked: boolean) => {
    if (!myUid || !roomId || myUid === peerUid) return;
    const path = ref(db, `userBlocks/${myUid}/rooms/${roomId}/${peerUid}`);
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
    const r = ref(db, `userBlocks/${myUid}/global`);
    const off = onValue(r, (snap) => setMap((snap.val() as any) ?? {}));
    return () => off();
  }, [myUid]);

  const setBlocked = async (peerUid: string, blocked: boolean) => {
    if (!myUid || myUid === peerUid) return;
    const path = ref(db, `userBlocks/${myUid}/global/${peerUid}`);
    blocked ? await set(path, true) : await remove(path);
  };

  const blockedSet = useMemo(() => new Set(Object.keys(map || {})), [map]);
  const isBlocked = (peerUid: string) => blockedSet.has(peerUid);

  return { blockedSet, isBlocked, setBlocked };
}


