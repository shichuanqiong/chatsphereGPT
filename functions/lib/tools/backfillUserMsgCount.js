import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
const db = admin.database();
export const backfillUserMsgCount = functions.https.onCall(async (request) => {
    try {
        const data = request.data;
        const context = request;
        // 权限检查：仅认证用户且必须是 admin
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
        }
        const uid = context.auth.uid;
        // 检查该用户是否为 admin
        const adminSnap = await db.ref(`roles/${uid}/admin`).get();
        if (!adminSnap.exists() || adminSnap.val() !== true) {
            throw new functions.https.HttpsError('permission-denied', 'User is not admin');
        }
        console.log(`[backfillUserMsgCount] Starting backfill by admin: ${uid}`);
        const counts = new Map();
        // 遍历所有房间的消息
        const messagesRef = db.ref('messages');
        const roomsSnap = await messagesRef.get();
        let totalMessages = 0;
        let processedRooms = 0;
        roomsSnap.forEach((roomSnap) => {
            const roomId = roomSnap.key;
            let roomMsgCount = 0;
            roomSnap.forEach((msgSnap) => {
                const m = msgSnap.val();
                const authorId = m?.authorId;
                if (authorId && typeof authorId === 'string') {
                    counts.set(authorId, (counts.get(authorId) || 0) + 1);
                    roomMsgCount++;
                    totalMessages++;
                }
            });
            processedRooms++;
            console.log(`[backfillUserMsgCount] Room ${roomId}: ${roomMsgCount} messages processed`);
        });
        console.log(`[backfillUserMsgCount] Total rooms: ${processedRooms}, Total messages: ${totalMessages}, Unique users: ${counts.size}`);
        // 批量写入到 profilesStats
        const updates = {};
        counts.forEach((cnt, authorId) => {
            updates[`profilesStats/${authorId}/messageCount`] = cnt;
        });
        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
            console.log(`[backfillUserMsgCount] Backfill completed: ${counts.size} users updated`);
        }
        else {
            console.log('[backfillUserMsgCount] No messages found to backfill');
        }
        return {
            ok: true,
            users: counts.size,
            totalMessages,
            processedRooms,
        };
    }
    catch (err) {
        console.error('[backfillUserMsgCount] Error:', err);
        throw err;
    }
});
//# sourceMappingURL=backfillUserMsgCount.js.map