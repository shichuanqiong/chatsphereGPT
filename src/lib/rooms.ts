import { ref, set, push, serverTimestamp, get, runTransaction, onDisconnect } from 'firebase/database';
import { db, auth } from '../firebase';

type CreatePayload = {
  name: string;
  visibility: 'public' | 'private';
  icon?: string;
};

export async function createRoomAndEnter(payload: CreatePayload): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('unauthenticated');

  const roomId = push(ref(db, 'rooms')).key!;
  const now = Date.now();
  const expiresAt = now + 8 * 60 * 60 * 1000; // 8 小时

  await set(ref(db, `rooms/${roomId}`), {
    id: roomId,
    name: payload.name,
    // 兼容：保留公开/私密
    visibility: payload.visibility,
    // 房间类型：用户创建
    type: 'user',
    icon: payload.icon ?? '💬',
    ownerId: uid,
    createdAt: serverTimestamp(),
    expiresAt,
    status: 'active',
  });

  // 房主立即加入（对象值/布尔皆可；此处使用对象以携带时间与角色）
  await set(ref(db, `roomMembers/${roomId}/${uid}`), {
    role: 'owner',
    joinedAt: serverTimestamp(),
  });

  // 返回给调用方做导航
  return roomId;
}

// 防呆：加入房间前校验过期
export async function joinRoom(roomId: string, uid: string): Promise<void> {
  const snap = await get(ref(db, `rooms/${roomId}`));
  const v = snap.val();
  if (!v) throw new Error('room_not_found');
  if (typeof v.expiresAt === 'number' && Date.now() >= v.expiresAt) {
    throw new Error('room_expired');
  }

  const memberRef = ref(db, `roomMembers/${roomId}/${uid}`);
  let existed = false;
  await runTransaction(memberRef, (cur) => {
    if (cur) { existed = true; return cur; }
    return true;
  });
  onDisconnect(memberRef).remove();
}


