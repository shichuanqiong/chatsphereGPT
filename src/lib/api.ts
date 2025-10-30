/**
 * Firebase Cloud Functions Admin API Client
 * ★ 超详细的调试日志
 */

const BASE = import.meta.env.VITE_API_BASE || 'https://us-central1-chatspheregpt.cloudfunctions.net/api';
const KEY = import.meta.env.VITE_ADMIN_KEY || 'ChatSphere2025Secure!@#$%';

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
