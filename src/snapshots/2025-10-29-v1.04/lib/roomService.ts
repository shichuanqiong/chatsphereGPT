import { ref, get, set, serverTimestamp, onChildAdded, onChildRemoved, off, onValue, update } from 'firebase/database';
import { db } from '../firebase';

export async function joinRoom(roomId: string, uid: string) {
  // 过期防呆：若房间已过期，拒绝加入
  try {
    const roomSnap = await get(ref(db, `rooms/${roomId}`));
    const room = roomSnap.val();
    if (!room) throw new Error('room_not_found');
    if (room.expiresAt && Date.now() >= room.expiresAt) {
      throw new Error('room_expired');
    }
  } catch (e) {
    if ((e as any)?.message) throw e;
  }
  // 若被ban则阻止
  const bannedSnap = await get(ref(db, `rooms/${roomId}/bans/${uid}`));
  if (bannedSnap.exists()) {
    throw new Error('banned');
  }

  // 加入成员表（本人写自己）
  await set(ref(db, `roomMembers/${roomId}/${uid}`), true);
}

/**
 * 接受邀请（原子性操作）
 */
export async function acceptInvite(roomId: string, uid: string, inboxId?: string) {
  const updates: any = {};
  
  // 删除邀请
  updates[`rooms/${roomId}/invites/${uid}`] = null;
  
  // 添加成员
  updates[`roomMembers/${roomId}/${uid}`] = true;
  
  // 删除 inbox 中的邀请消息（如果提供了 inboxId）
  if (inboxId) {
    updates[`inbox/${uid}/${inboxId}`] = null;
  }
  
  await update(ref(db), updates);
}

/**
 * 踢出用户
 */
export async function kickUser(roomId: string, targetUid: string) {
  const updates: any = {};
  updates[`roomMembers/${roomId}/${targetUid}`] = null;
  await update(ref(db), updates);
}

/**
 * 封禁用户
 */
export async function banUser(roomId: string, targetUid: string) {
  const updates: any = {};
  updates[`rooms/${roomId}/bans/${targetUid}`] = true;
  updates[`roomMembers/${roomId}/${targetUid}`] = null;
  await update(ref(db), updates);
}

/**
 * 解除封禁
 */
export async function unbanUser(roomId: string, targetUid: string) {
  const updates: any = {};
  updates[`rooms/${roomId}/bans/${targetUid}`] = null;
  await update(ref(db), updates);
}

/**
 * 拒绝邀请
 */
export async function declineInvite(roomId: string, uid: string, inboxId?: string) {
  const updates: any = {};
  updates[`rooms/${roomId}/invites/${uid}`] = null;
  
  // 删除 inbox 中的邀请消息（如果提供了 inboxId）
  if (inboxId) {
    updates[`inbox/${uid}/${inboxId}`] = null;
  }
  
  await update(ref(db), updates);
}

/**
 * 监听房间成员身份和封禁状态（入场控制）
 */
export function watchRoomAccess(
  roomId: string,
  uid: string,
  onBanned: () => void,
  onRemoved: () => void
) {
  const memberRef = ref(db, `roomMembers/${roomId}/${uid}`);
  const banRef = ref(db, `rooms/${roomId}/bans/${uid}`);
  
  // 监听成员状态
  const memberUnsub = onValue(memberRef, (snap) => {
    if (!snap.exists()) {
      onRemoved(); // 被踢出或离开
    }
  });
  
  // 监听封禁状态
  const banUnsub = onValue(banRef, (snap) => {
    if (snap.exists()) {
      onBanned(); // 被封禁
    }
  });
  
  return () => {
    memberUnsub();
    banUnsub();
  };
}

export function watchRoomMembers(
  roomId: string,
  onUpdate: (list: Array<{ uid: string; profile: any }>) => void
) {
  const membersRef = ref(db, `roomMembers/${roomId}`);
  const cache = new Map<string, any>();

  const emit = () => onUpdate([...cache.entries()].map(([uid, profile]) => ({ uid, profile })));

  const add = async (uid: string) => {
    const prof = (await get(ref(db, `profiles/${uid}`))).val() || { uid };
    cache.set(uid, prof);
    emit();
  };

  const remove = (uid: string) => {
    cache.delete(uid);
    emit();
  };

  const a = onChildAdded(membersRef, (snap) => add(snap.key!));
  const r = onChildRemoved(membersRef, (snap) => remove(snap.key!));

  return () => { 
    off(membersRef, 'child_added', a); 
    off(membersRef, 'child_removed', r); 
  };
}
