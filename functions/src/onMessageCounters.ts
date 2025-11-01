import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const db = admin.database();

// 1) 新消息 => 计数 +1，刷新 lastMessageAt
export const onMessageCreate = functions.database
  .ref('/messages/{roomId}/{msgId}')
  .onCreate(async (snap, ctx) => {
    try {
      const msg = snap.val() as { authorId?: string; createdAt?: number };

      if (!msg?.authorId) return null;

      const uid = msg.authorId;
      const statsRef = db.ref(`profilesStats/${uid}`);

      await statsRef.child('messageCount').transaction(n => (n || 0) + 1);
      await statsRef.child('lastMessageAt').set(msg.createdAt || Date.now());

      console.log(`[onMessageCreate] ${uid}: messageCount +1, lastMessageAt updated`);
      return null;
    } catch (err: any) {
      console.error('[onMessageCreate] Error:', err);
      return null;
    }
  });

// 2) 删除消息 => 计数 -1（不为负）
export const onMessageDelete = functions.database
  .ref('/messages/{roomId}/{msgId}')
  .onDelete(async (snap, ctx) => {
    try {
      const msg = snap.val() as { authorId?: string };

      if (!msg?.authorId) return null;

      const uid = msg.authorId;
      const statsRef = db.ref(`profilesStats/${uid}`);

      await statsRef.child('messageCount').transaction(n => {
        const v = typeof n === 'number' ? n : 0;
        return v > 0 ? v - 1 : 0;
      });

      console.log(`[onMessageDelete] ${uid}: messageCount -1`);
      return null;
    } catch (err: any) {
      console.error('[onMessageDelete] Error:', err);
      return null;
    }
  });
