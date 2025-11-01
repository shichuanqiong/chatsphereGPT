import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const db = admin.database();

// Database trigger for message creation/updates
export const onMessageCreate = functions.database
  .onValueWritten('/messages/{roomId}/{msgId}', async (change) => {
    try {
      const after = change.data.after;
      const before = change.data.before;
      
      // Only process if message is being created (before doesn't exist, after does)
      if (before.exists() || !after.exists()) {
        return null;
      }
      
      const msg = after.val() as { authorId?: string; createdAt?: number };

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

// Database trigger for message deletion
export const onMessageDelete = functions.database
  .onValueWritten('/messages/{roomId}/{msgId}', async (change) => {
    try {
      const after = change.data.after;
      const before = change.data.before;
      
      // Only process if message is being deleted (before exists, after doesn't)
      if (!before.exists() || after.exists()) {
        return null;
      }
      
      const msg = before.val() as { authorId?: string };

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
