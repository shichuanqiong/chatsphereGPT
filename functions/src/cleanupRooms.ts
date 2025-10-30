import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDatabase } from 'firebase-admin/database';
import * as admin from 'firebase-admin';

// Initialize Admin SDK once
try { admin.app(); } catch { admin.initializeApp(); }

export const cleanupExpiredRooms = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'America/Los_Angeles' },
  async () => {
    const db = getDatabase();
    const now = Date.now();

    const expired = await db.ref('rooms').orderByChild('expiresAt').endAt(now).get();
    const updates: Record<string, any> = {};

    expired.forEach((s) => {
      const id = s.key!;
      const v = s.val() || {};
      if (v.type === 'official') return; // 官方房间永久保留
      updates[`rooms/${id}/status`] = 'expired';
      updates[`rooms/${id}/expiredAt`] = now;
      updates[`roomMembers/${id}`] = null;
      const sysId = db.ref(`messages/${id}`).push().key!;
      updates[`messages/${id}/${sysId}`] = {
        type: 'system', content: 'Room expired.', createdAt: now,
      };
    });

    if (Object.keys(updates).length) await db.ref().update(updates);

    // Hard delete after 10 minutes
    const toDelete = await db
      .ref('rooms')
      .orderByChild('expiredAt')
      .endAt(now - 10 * 60 * 1000)
      .get();

    const del: Record<string, any> = {};
    toDelete.forEach((s) => {
      const id = s.key!;
      const v = s.val() || {};
      if (v.type === 'official') return;
      del[`rooms/${id}`] = null;
      del[`messages/${id}`] = null;
      del[`roomMembers/${id}`] = null;
    });
    if (Object.keys(del).length) await db.ref().update(del);
  }
);


