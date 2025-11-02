/**
 * Firebase Cloud Functions Admin API Client
 * ★ 超详细的调试日志
 */

const BASE = import.meta.env.VITE_API_BASE || 'https://us-central1-chatspheregpt.cloudfunctions.net/api';
const KEY = import.meta.env.VITE_ADMIN_KEY || 'ChatSphere2025AdminSecure';

console.log('=== [AdminAPI] 初始化 ===');
console.log('BASE:', BASE);
console.log('KEY 长度:', KEY.length);
console.log('KEY 前10字符:', KEY.substring(0, 10));
console.log('KEY 完整:', KEY);
console.log('KEY 类型:', typeof KEY);
console.log('=== 初始化完成 ===\n');

/**
 * 确保一定发送 x-admin-key 的请求函数
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;

  console.log(`\n[AdminAPI] 准备请求: ${url}`);

  // ★ 直接在 fetch 参数中设置 headers，确保不会被覆盖
  const additionalHeaders = options?.headers ? (options.headers as Record<string, string>) : {};
  
  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': KEY,  // ← 直接设置，确保一定有
      ...additionalHeaders,
    },
    ...options,
  };

  console.log('[AdminAPI] 请求头详情:');
  console.log('  - Content-Type:', fetchOptions.headers?.['Content-Type'] || 'undefined');
  console.log('  - x-admin-key:', (fetchOptions.headers?.['x-admin-key'] as string)?.substring(0, 10) + '...' || 'undefined');
  console.log('  - x-admin-key 完整:', fetchOptions.headers?.['x-admin-key']);

  try {
    console.log('[AdminAPI] 发送 fetch 请求...');
    const response = await fetch(url, fetchOptions);

    console.log(`[AdminAPI] ✓ 收到响应: ${response.status} ${response.statusText}`);
    console.log('[AdminAPI] 响应头:', {
      'content-type': response.headers.get('content-type'),
      'x-custom-header': response.headers.get('x-custom-header'),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AdminAPI] ✗ HTTP ${response.status} Error:`, errorText);
      throw new Error(`API Error ${response.status}: ${response.statusText}\n${errorText}`);
    }

    const data = await response.json() as T;
    console.log('[AdminAPI] ✓ 解析数据成功:', data);
    return data;
  } catch (error) {
    console.error('[AdminAPI] ✗ 请求失败:', error);
    throw error;
  }
}

/**
 * Direct RTDB message counting (per-room iteration)
 * 快速修：按房间循环统计 24 小时内的消息
 */
export async function countMessages24hFromRTDB() {
  try {
    const { ref: dbRef, get, query, orderByChild, startAt, getDatabase } = await import('firebase/database');
    
    const db = getDatabase();
    const now = Date.now();
    const from = now - 24 * 60 * 60 * 1000; // 24小时前

    console.log('[countMessages24h] Start. now:', now, 'from:', from);

    // 1) 先取所有房间ID
    const messagesSnap = await get(dbRef(db, 'messages'));
    console.log('[countMessages24h] roomsSnap.exists():', messagesSnap.exists());
    
    if (!messagesSnap.exists()) {
      console.log('[countMessages24h] No messages found');
      return { total: 0, perRoom: {}, topRooms: [] };
    }

    const perRoom: Record<string, number> = {};
    let total = 0;
    const messagesData = messagesSnap.val();
    const roomIds = Object.keys(messagesData);
    
    console.log('[countMessages24h] roomIds count:', roomIds.length, 'roomIds:', roomIds);

    // 2) 按房间循环计数（不用 query，直接遍历数据）
    for (const roomId of roomIds) {
      const messagesInRoom = messagesData[roomId];
      if (!messagesInRoom || typeof messagesInRoom !== 'object') {
        perRoom[roomId] = 0;
        continue;
      }

      let count = 0;
      Object.entries(messagesInRoom).forEach(([msgId, msgData]: [string, any]) => {
        const createdAt = msgData?.createdAt;
        
        // 检查 createdAt 类型
        if (typeof createdAt === 'number') {
          if (createdAt >= from && createdAt <= now) {
            count++;
          }
        }
      });

      perRoom[roomId] = count;
      total += count;
      console.log(`[countMessages24h] Room ${roomId}: ${count} messages`);
    }

    // 3) 计算 Top Rooms
    const topRooms = Object.entries(perRoom)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([roomId, count]) => ({ roomId, count }));

    // 获取房间名字
    const roomsSnap = await get(dbRef(db, 'rooms'));
    const roomsData = roomsSnap.exists() ? roomsSnap.val() : {};
    
    const topRoomsWithNames = topRooms.map(room => {
      const roomInfo = roomsData[room.roomId];
      const roomName = roomInfo?.name || room.roomId;  // 如果没有名字就用 ID
      return { name: roomName, count: room.count };
    });

    console.log(`[countMessages24h] Total: ${total}, TopRooms:`, topRoomsWithNames);
    return { total, perRoom, topRooms: topRoomsWithNames };
  } catch (err: any) {
    console.error('[countMessages24h] Error:', err);
    return { total: 0, perRoom: {}, topRooms: [] };
  }
}

/**
 * Calculate Daily Active Users (DAU) in real-time from RTDB
 * Counts unique users who sent messages in the last 24 hours
 */
export async function calculateDAUFromRTDB() {
  try {
    const { ref: dbRef, get, getDatabase } = await import('firebase/database');
    const db = getDatabase();
    
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000; // 24 小时前

    const messagesSnap = await get(dbRef(db, 'messages'));
    if (!messagesSnap.exists()) {
      console.log('[calculateDAU] No messages found, dau=0');
      return 0;
    }

    const messagesData = messagesSnap.val();
    const uniqueUsers = new Set<string>();

    // 遍历所有房间的消息
    Object.entries(messagesData).forEach(([roomId, roomMessages]: [string, any]) => {
      if (!roomMessages || typeof roomMessages !== 'object') return;

      Object.entries(roomMessages).forEach(([_, msg]: [string, any]) => {
        const createdAt = msg?.createdAt;
        const authorId = msg?.authorId;

        // 检查时间戳类型和范围（24小时内）
        if (typeof createdAt === 'number' && createdAt >= oneDayAgo && createdAt <= now) {
          // 检查用户 ID
          if (authorId && typeof authorId === 'string') {
            uniqueUsers.add(authorId);
          }
        }
      });
    });

    const dau = uniqueUsers.size;
    console.log(`[calculateDAU] DAU=${dau}, unique users:`, Array.from(uniqueUsers));
    return dau;
  } catch (err: any) {
    console.error('[calculateDAU] Error:', err);
    return 0;
  }
}

/**
 * Admin API endpoints
 */
export const AdminAPI = {
  /**
   * Get summary metrics (online, msg24h, dau)
   */
  summary: async () => {
    console.log('\n[AdminAPI] 调用 summary()');
    return request<{ online: number; msg24h: number; dau: number }>(
      '/admin/metrics/summary'
    );
  },

  /**
   * Get 24-hour message buckets
   */
  buckets: async () => {
    console.log('\n[AdminAPI] 调用 buckets()');
    return request<{ buckets: Array<{ h: number; c: number }> }>(
      '/admin/metrics/messages24h'
    );
  },

  /**
   * Get top rooms
   */
  topRooms: async () => {
    console.log('\n[AdminAPI] 调用 topRooms()');
    return request<{ rooms: Array<{ name: string; count: number }> }>(
      '/admin/metrics/top-rooms'
    );
  },

  /**
   * Get users list
   */
  users: async () => {
    console.log('\n[AdminAPI] 调用 users()');
    return request<{
      users: Array<{
        uid: string;
        name: string;
        email: string;
        status: string;
        messageCount: number;
        createdAt?: any;
        lastSeen?: any;
      }>;
    }>('/admin/users');
  },

  /**
   * Get rooms list
   */
  rooms: async () => {
    console.log('\n[AdminAPI] 调用 rooms()');
    return request<{
      rooms: Array<{
        id: string;
        name: string;
        type: string;
        description: string;
        memberCount: number;
        messageCount: number;
        createdAt?: any;
        createdBy?: string;
      }>;
    }>('/admin/rooms');
  },

  /**
   * Get reports list
   */
  reports: async () => {
    console.log('\n[AdminAPI] 调用 reports()');
    return request<{
      reports: Array<{
        id: string;
        userId: string;
        userName: string;
        reason: string;
        status: 'pending' | 'resolved' | 'rejected';
        createdAt: number;
        resolvedAt?: number;
        resolvedBy?: string;
        description: string;
      }>;
    }>('/admin/reports');
  },

  /**
   * Stream real-time metrics via Server-Sent Events
   */
  stream: (
    onData: (data: {
      online?: number;
      msg24h?: number;
      dau?: number;
      buckets?: Array<{ h: number; c: number }>;
      rooms?: Array<{ name: string; count: number }>;
    }) => void
  ) => {
    const streamUrl = `${BASE}/admin/metrics/stream`;
    console.log('[AdminAPI] 启动 SSE 流:', streamUrl);

    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[AdminAPI] SSE 消息:', data);
        onData(data);
      } catch (err) {
        console.error('[AdminAPI] SSE 解析失败:', err);
      }
    };

    eventSource.addEventListener('tick', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[AdminAPI] SSE tick:', data);
        onData(data);
      } catch (err) {
        console.error('[AdminAPI] SSE tick 解析失败:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.error('[AdminAPI] SSE 连接错误:', err);
      eventSource.close();
    };

    return () => {
      console.log('[AdminAPI] 关闭 SSE 流');
      eventSource.close();
    };
  },

  /**
   * Generate sitemap
   */
  generateSitemap: async () => {
    console.log('\n[AdminAPI] 调用 generateSitemap()');
    return request<{
      success: boolean;
      message: string;
      timestamp: string;
      roomCount: number;
      sitemapPreview: string;
    }>('/admin/seo/generate-sitemap', { method: 'POST' });
  },

  /**
   * Ban user
   */
  banUser: async (userId: string, reason?: string) => {
    console.log('\n[AdminAPI] 调用 banUser()', userId);
    return request<{ success: boolean; message: string }>(
      `/admin/users/${userId}/ban`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  },

  /**
   * Kick user (force offline)
   */
  kickUser: async (userId: string) => {
    console.log('\n[AdminAPI] 调用 kickUser()', userId);
    return request<{ success: boolean; message: string }>(
      `/admin/users/${userId}/kick`,
      { method: 'POST' }
    );
  },

  /**
   * Delete user
   */
  deleteUser: async (userId: string) => {
    console.log('\n[AdminAPI] 调用 deleteUser()', userId);
    return request<{ success: boolean; message: string }>(
      `/admin/users/${userId}/delete`,
      { method: 'POST' }
    );
  },
};

export default AdminAPI;
