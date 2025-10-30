import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';

/**
 * 一次性补齐 rooms.expiresAt，并将已到期的房间标记为 expired（可选清空成员）。
 * 默认 8 小时，如需调整传 hours 参数。
 */
export async function backfillRoomExpiry(hours = 8): Promise<void> {
  const now = Date.now();
  const snap = await get(ref(db, 'rooms'));
  if (!snap.exists()) return;

  const updates: Record<string, any> = {};
  snap.forEach((roomSnap: any) => {
    const id = roomSnap.key as string;
    const v = roomSnap.val() || {};

    // 跳过官方房间
    if (v.isOfficial === true || v.type === 'official') return;

    if (!v.expiresAt) {
      const created = typeof v.createdAt === 'number' ? v.createdAt : now;
      const expiresAt = created + hours * 60 * 60 * 1000;
      updates[`rooms/${id}/expiresAt`] = expiresAt;
      if (now >= expiresAt) {
        updates[`rooms/${id}/status`] = 'expired';
        // 可选：清空成员，使在线用户被前端重定向
        updates[`roomMembers/${id}`] = null;
      }
    } else if (now >= v.expiresAt && v.status !== 'expired') {
      updates[`rooms/${id}/status`] = 'expired';
      updates[`rooms/${id}/expiredAt`] = now;
      updates[`roomMembers/${id}`] = null; // 可选
    }
  });

  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }
}

// 便于在控制台调用： backfillRoomExpiry(8)
(window as any).backfillRoomExpiry = backfillRoomExpiry;


