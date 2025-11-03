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

    // 2) 获取在线用户数 → /presence 中 state === "online" 的数量
    const presenceSnap = await get(ref(db, "presence"));
    const presence = presenceSnap.val() || {};
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 分钟超时
    const onlineNow = Object.values(presence).filter((u: any) => {
      if (!u || typeof u !== 'object') return false;
      // ★ 修复：加入 lastSeen 超时检查，与 getAdminUsersList 逻辑一致
      const lastSeen = u?.lastSeen ?? 0;
      return u.state === 'online' && now - lastSeen < timeout;
    }).length;

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

/**
 * ★ 新增：获取用户列表（直接从 RTDB）
 */
export async function getAdminUsersList() {
  try {
    // 1) 获取所有用户资料
    const profilesSnap = await get(ref(db, "profiles"));
    const profiles = profilesSnap.val() || {};

    // 2) 获取在线状态
    const presenceSnap = await get(ref(db, "presence"));
    const presence = presenceSnap.val() || {};

    // 3) 获取用户统计信息
    const statsSnap = await get(ref(db, "profilesStats"));
    const stats = statsSnap.val() || {};

    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 分钟内活跃

    // 4) 组合数据
    const users = Object.entries(profiles).map(([uid, profileData]: [string, any]) => {
      const presenceData = presence[uid] || {};
      const lastSeen = presenceData?.lastSeen ?? 0;
      const isOnline = presenceData?.state === 'online' && now - lastSeen < timeout;
      const statData = stats[uid] || {};

      return {
        uid,
        name: profileData?.nickname || profileData?.displayName || `User ${uid.slice(0, 6)}`,
        email: profileData?.email || '',
        status: isOnline ? 'online' : 'offline',
        messageCount: statData?.messageCount ?? 0,
        createdAt: profileData?.createdAt,
        lastSeen: presenceData?.lastSeen,
      };
    });

    console.log('[adminDataService] getAdminUsersList:', users.length, 'users');

    return {
      users,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[adminDataService] getAdminUsersList Error:', err);
    return {
      users: [],
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * ★ 新增：获取房间列表（直接从 RTDB）
 */
export async function getAdminRoomsList() {
  try {
    // 1) 获取所有房间
    const roomsSnap = await get(ref(db, "rooms"));
    const roomsData = roomsSnap.val() || {};

    const now = Date.now();
    const eightHoursAgo = now - 8 * 60 * 60 * 1000;

    // 2) 过滤并组合数据
    const rooms = Object.entries(roomsData)
      .filter(([_, roomData]: [string, any]) => {
        // 官方房间永远显示
        if (roomData?.isOfficial === true || roomData?.type === 'official') {
          return true;
        }
        // 用户房间只显示未过期的
        const expiresAt = roomData?.expiresAt || (roomData?.createdAt || 0) + 8 * 60 * 60 * 1000;
        return expiresAt > now;
      })
      .map(([id, roomData]: [string, any]) => ({
        id,
        name: roomData?.name || 'Unnamed Room',
        type: (roomData?.isOfficial || roomData?.type === 'official') ? 'official' : 'user',
        description: roomData?.description || '',
        memberCount: roomData?.memberCount || 0,
        messageCount: roomData?.messageCount || 0,
        createdAt: roomData?.createdAt,
        createdBy: roomData?.createdBy || roomData?.ownerId,
        isOfficial: roomData?.isOfficial || roomData?.type === 'official',
      }));

    console.log('[adminDataService] getAdminRoomsList:', rooms.length, 'rooms');

    return {
      rooms,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[adminDataService] getAdminRoomsList Error:', err);
    return {
      rooms: [],
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}
