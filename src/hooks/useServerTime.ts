import { useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/firebase";

/**
 * Returns the current Firebase server time (in milliseconds)
 * by reading .info/serverTimeOffset and adding it to local Date.now()
 */
export function useServerTime() {
  const [serverNow, setServerNow] = useState<number | null>(null);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    if (!db) {
      console.error("[useServerTime] Database not initialized");
      return;
    }

    const offsetRef_db = ref(db, ".info/serverTimeOffset");
    
    const unsub = onValue(
      offsetRef_db,
      (snap) => {
        const offset = snap.val() || 0; // milliseconds
        offsetRef.current = offset;
        const now = Date.now() + offset;
        setServerNow(now);
        console.log("[useServerTime] Offset updated:", offset, "ms, serverNow:", now);
      },
      (error) => {
        console.error("[useServerTime] Error reading server time offset:", error);
      }
    );

    // Also update serverNow every 10 seconds to stay in sync
    const interval = setInterval(() => {
      const now = Date.now() + offsetRef.current;
      setServerNow(now);
    }, 10_000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return serverNow;
}
