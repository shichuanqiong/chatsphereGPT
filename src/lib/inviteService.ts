import { ref, set, push, serverTimestamp, get, remove } from 'firebase/database';
import { db } from '../firebase';

export async function inviteToRoom(roomId: string, inviterUid: string, targetUid: string) {
  // 先创建 Inbox 条目，拿到 inboxId
  const inboxRef = push(ref(db, `inbox/${targetUid}`));
  const inboxId = inboxRef.key!;

  await set(inboxRef, {
    type: 'room_invite',
    roomId,
    inviterUid,
    to: targetUid,
    unread: true,
    ts: serverTimestamp()
  });

  // 写邀请记录到房间内部，携带 inboxId，便于后续删除
  await set(ref(db, `rooms/${roomId}/invites/${targetUid}`), {
    from: inviterUid,
    createdAt: serverTimestamp(),
    inboxId
  });
}

export async function acceptRoomInvite(roomId: string, uid: string) {
  // ban 检查
  const banned = (await get(ref(db, `rooms/${roomId}/bans/${uid}`))).exists();
  if (banned) throw new Error('banned');

  const invRef = ref(db, `rooms/${roomId}/invites/${uid}`);
  const snap = await get(invRef);
  const data = snap.val() || {};
  const inboxId: string | undefined = data.inboxId;

  // 加入成员
  await set(ref(db, `rooms/${roomId}/members/${uid}`), { 
    role: 'member', 
    joinedAt: serverTimestamp() 
  });

  // 删邀请记录
  await remove(invRef);

  // 删除 Inbox 邀请消息
  if (inboxId) await remove(ref(db, `inbox/${uid}/${inboxId}`));
}

export async function declineRoomInvite(roomId: string, uid: string) {
  const invRef = ref(db, `rooms/${roomId}/invites/${uid}`);
  const snap = await get(invRef);
  const data = snap.val() || {};
  const inboxId: string | undefined = data.inboxId;

  // 直接删除邀请记录
  await remove(invRef);
  
  // 删除 Inbox 邀请消息
  if (inboxId) await remove(ref(db, `inbox/${uid}/${inboxId}`));
}
