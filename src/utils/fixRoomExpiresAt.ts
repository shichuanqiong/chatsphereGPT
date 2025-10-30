import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';

/**
 * 为历史房间补齐 expiresAt 字段（8 小时过期）
 * - 若存在 autoCloseAt，迁移为 expiresAt
 * - 若二者都不存在且有 createdAt，则按 createdAt+8h 生成
 */
export async function fixRoomExpiresAt(): Promise<void> {
  try {
    const roomsSnap = await get(ref(db, 'rooms'));
    if (!roomsSnap.exists()) return;

    const rooms = roomsSnap.val() as Record<string, any>;
    const ops: Record<string, any> = {};
    let count = 0;

    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.isOfficial === true || room.type === 'official') continue;

      // 若已有 expiresAt 则跳过
      if (typeof room?.expiresAt === 'number') continue;

      let expiresAt: number | null = null;
      if (typeof room?.autoCloseAt === 'number') {
        expiresAt = room.autoCloseAt;
      } else if (typeof room?.createdAt === 'number') {
        expiresAt = room.createdAt + 8 * 60 * 60 * 1000;
      }

      if (expiresAt) {
        ops[`rooms/${roomId}/expiresAt`] = expiresAt;
        // 兼容：可以选择删除 autoCloseAt（不强制）
        // ops[`rooms/${roomId}/autoCloseAt`] = null;
        count++;
      }
    }

    if (Object.keys(ops).length) {
      await update(ref(db), ops);
      console.log(`[fixRoomExpiresAt] updated ${count} rooms`);
    }
  } catch (e) {
    console.warn('[fixRoomExpiresAt] failed:', e);
  }
}

// 自动运行一次，便于上线后快速补齐（可按需移除）
(async () => {
  await fixRoomExpiresAt();
})();


