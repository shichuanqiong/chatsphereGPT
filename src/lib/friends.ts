import { ref, get, set, remove } from 'firebase/database';
import { db, auth } from '../firebase';

export async function isFriend(friendId: string) {
  const uid = auth.currentUser?.uid; 
  if (!uid) return false;
  if (friendId === uid) return false; // 自己永远不是"好友"
  const s = await get(ref(db, `friends/${uid}/${friendId}`));
  return s.exists();
}

export async function addFriend(friendId: string) {
  const uid = auth.currentUser?.uid; 
  if (!uid) return;
  if (friendId === uid) return; // 禁止加自己
  await set(ref(db, `friends/${uid}/${friendId}`), true);
}

export async function removeFriend(friendId: string) {
  const uid = auth.currentUser?.uid; 
  if (!uid) return;
  if (friendId === uid) return; // 没意义
  await remove(ref(db, `friends/${uid}/${friendId}`));
}

