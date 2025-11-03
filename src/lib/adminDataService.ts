import { get, ref } from "firebase/database";
import { db } from "@/firebase";

/**
 * ★ Admin Data Service
 * Reads directly from Firebase RTDB nodes to get admin statistics
 * No dependency on Cloud Functions or Firestore
 */

export async function getAdminStats() {
  try {
    // 1) 获取总用户数 → /profiles 节点的子项数量
    const profilesSnap = await get(ref(db, "profiles"));
    const profiles = profilesSnap.val() || {};
    const totalUsers = Object.keys(profiles).length;

    console.log('[adminDataService] profiles count:', totalUsers, 'sample:', Object.keys(profiles).slice(0, 3));

    // 2) 获取在线用户数 → /presence 节点中 state === "online" 的数量
    const presenceSnap = await get(ref(db, "presence"));
    const presence = presenceSnap.val() || {};
    const onlineNow = Object.values(presence).filter(
      (u: any) => u && typeof u === 'object' && u.state === 'online'
    ).length;

    console.log('[adminDataService] presence count:', Object.keys(presence).length, 'online:', onlineNow);

    // 3) 获取活跃房间数 → /rooms 节点的子项数量
    const roomsSnap = await get(ref(db, "rooms"));
    const rooms = roomsSnap.val() || {};
    const activeRooms = Object.keys(rooms).length;

    console.log('[adminDataService] rooms count:', activeRooms, 'sample:', Object.keys(rooms).slice(0, 3));

    // 4) 消息数(24小时) → 从 /messages 扫描过去 24 小时的消息
    let messages24h = 0;
    const messagesSnap = await get(ref(db, "messages"));
    if (messagesSnap.exists()) {
      const messagesData = messagesSnap.val() || {};
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      Object.values(messagesData).forEach((roomMessages: any) => {
        if (!roomMessages || typeof roomMessages !== 'object') return;
        Object.values(roomMessages).forEach((msg: any) => {
          if (msg?.createdAt && msg.createdAt >= oneDayAgo && msg.createdAt <= now) {
            messages24h++;
          }
        });
      });
    }

    console.log('[adminDataService] messages24h:', messages24h);

    // 5) DAU (Daily Active Users) → 过去 24 小时内发送过消息的唯一用户数
    let dau = 0;
    const uniqueUsers = new Set<string>();
    const messagesSnap2 = await get(ref(db, "messages"));
    if (messagesSnap2.exists()) {
      const messagesData = messagesSnap2.val() || {};
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      Object.values(messagesData).forEach((roomMessages: any) => {
        if (!roomMessages || typeof roomMessages !== 'object') return;
        Object.values(roomMessages).forEach((msg: any) => {
          if (
            msg?.createdAt && 
            msg.createdAt >= oneDayAgo && 
            msg.createdAt <= now &&
            msg?.authorId
          ) {
            uniqueUsers.add(msg.authorId);
          }
        });
      });
      dau = uniqueUsers.size;
    }

    console.log('[adminDataService] dau:', dau);

    return {
      totalUsers,
      onlineNow,
      activeRooms,
      messages24h,
      dau,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[adminDataService] Error:', err);
    // 返回默认值而不是抛出错误
    return {
      totalUsers: 0,
      onlineNow: 0,
      activeRooms: 0,
      messages24h: 0,
      dau: 0,
      timestamp: new Date().toISOString(),
      error: err.message,
    };
  }
}
