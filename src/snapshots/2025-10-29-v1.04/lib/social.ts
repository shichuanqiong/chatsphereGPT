// src/lib/social.ts
import { db, auth } from "../firebase";
import { ref, update, remove, get } from "firebase/database";

export async function blockUser(targetUid: string) {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await update(ref(db), { [`blocks/${me}/${targetUid}`]: true });
}

export async function unblockUser(targetUid: string) {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await remove(ref(db, `blocks/${me}/${targetUid}`));
}

export async function muteUser(targetUid: string) {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await update(ref(db), { [`mutes/${me}/${targetUid}`]: true });
}

export async function unmuteUser(targetUid: string) {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await remove(ref(db, `mutes/${me}/${targetUid}`));
}

export async function canSendTo(targetUid: string) {
  const me = auth.currentUser?.uid;
  if (!me) return false;
  
  // 我屏蔽了对方 or 对方屏蔽了我 → 不发送
  const a = await get(ref(db, `blocks/${me}/${targetUid}`));
  if (a.exists()) return false;
  const b = await get(ref(db, `blocks/${targetUid}/${me}`));
  if (b.exists()) return false;
  return true;
}