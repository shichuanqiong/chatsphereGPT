import * as functions from 'firebase-functions/v2';
import admin from 'firebase-admin';
import express, { Request, Response } from 'express';
import cors from 'cors';
// Temporarily disabled - will be fixed in next iteration
// import { onMessageCreate, onMessageDelete } from './onMessageCounters.js';
// import { backfillUserMsgCount } from './tools/backfillUserMsgCount.js';

// Initialize
admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

// Express App
const app = express();
const allowedOrigins = [
  'https://shichuanqiong.github.io',
  'https://chatsphere.live',
  'https://www.chatsphere.live',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];

// ★ 更明确的 CORS 配置，允许自定义头
app.use(cors({
  origin: allowedOrigins,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-key'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

app.use(express.json());

// ★ Admin Key - 从环境变量读取（Firebase deploy 会自动设置）
const ADMIN_KEY = (() => {
  try {
    // Firebase 在部署时会从 .env.local 或通过 --set-env-vars 设置环境变量
    // 或通过 Secret Manager 注入
    const envKey = process.env.ADMIN_KEY;
    if (envKey) {
      console.log('[INIT] ✓ ADMIN_KEY from process.env.ADMIN_KEY');
      console.log('[INIT] Key length:', envKey.length);
      console.log('[INIT] First 10 chars:', envKey.substring(0, 10));
      console.log('[INIT] Last 10 chars:', envKey.substring(envKey.length - 10));
      return envKey;
    }
  } catch (e) {
    console.log('[INIT] ⚠ process.env.ADMIN_KEY error:', e);
  }
  
  // 备用：硬编码（本地开发或没有配置时）
  // 使用与前端相同的 fallback 值
  console.log('[INIT] ⚠ ADMIN_KEY hardcoded (fallback)');
  const fallbackKey = 'ChatSphere2025AdminSecure';
  console.log('[INIT] Fallback key length:', fallbackKey.length);
  return fallbackKey;
})();

console.log('[INIT] ADMIN_KEY ready: ✓');
console.log('[INIT] Final key length:', ADMIN_KEY.length);
console.log('[INIT] Final key preview:', ADMIN_KEY.substring(0, 5) + '...' + ADMIN_KEY.substring(ADMIN_KEY.length - 5));
console.log('[INIT] Environment:', process.env.NODE_ENV || 'production');
console.log('[INIT] Emulator mode:', !!process.env.FUNCTIONS_EMULATOR);

// 鉴权中间件
app.use((req: Request, res: Response, next) => {
  if (req.path.startsWith('/admin')) {
    const receivedKey = req.header('x-admin-key');
    console.log('[AUTH] Path:', req.path);
    console.log('[AUTH] Received key:', receivedKey ? `${receivedKey.substring(0, 10)}...` : 'MISSING');
    console.log('[AUTH] Expected key:', ADMIN_KEY ? `${ADMIN_KEY.substring(0, 10)}...` : 'MISSING');
    console.log('[AUTH] Match:', receivedKey === ADMIN_KEY ? '✓ YES' : '✗ NO');
    
    if (receivedKey !== ADMIN_KEY) {
      console.log('[AUTH] REJECTED - Key mismatch');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.log('[AUTH] ACCEPTED');
  }
  next();
});

// ============ API 端点 ============

// 1) 汇总指标
app.get('/admin/metrics/summary', async (_req: Request, res: Response) => {
  try {
    const snap = await db.doc('metrics/runtime').get();
    const data = snap.exists ? snap.data() : {};
    res.json({
      online: data?.onlineNow ?? 0,
      msg24h: data?.msg24h ?? 0,
      dau: data?.dau ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2) 24小时消息分桶
app.get('/admin/metrics/messages24h', async (_req: Request, res: Response) => {
  try {
    const snap = await db.doc('metrics/runtime').get();
    const data = snap.exists ? snap.data() : {};
    res.json({ buckets: data?.buckets ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3) 热门房间
app.get('/admin/metrics/top-rooms', async (_req: Request, res: Response) => {
  try {
    const snap = await db.doc('metrics/runtime').get();
    const data = snap.exists ? snap.data() : {};
    res.json({ rooms: data?.topRooms ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4) 用户列表（来自 RTDB /profiles 和 /profilesStats）
app.get('/admin/users', async (_req: Request, res: Response) => {
  try {
    // 获取用户基础信息
    const profilesSnap = await rtdb.ref('/profiles').get();
    const profilesData = profilesSnap.val() || {};
    
    // 获取用户统计信息（messageCount、lastMessageAt）
    const statsSnap = await rtdb.ref('/profilesStats').get();
    const statsData = statsSnap.val() || {};
    
    // 同时获取在线状态
    const presenceSnap = await rtdb.ref('/presence').get();
    const presenceData = presenceSnap.val() || {};
    
    const now = Date.now();
    const timeout = 60 * 1000;
    
    const users = Object.entries(profilesData).map(([uid, data]: [string, any]) => {
      const presence = presenceData[uid];
      const lastSeen = presence?.lastSeen ?? 0;
      const isOnline = presence?.state === 'online' && now - lastSeen < timeout;
      
      // 从 profilesStats 读取统计数据
      const stats = statsData[uid] || {};
      
      return {
        uid,
        name: data.nickname || data.displayName || data.name || '未知用户',
        email: data.email || '',
        status: isOnline ? 'online' : 'offline',
        messageCount: stats.messageCount ?? 0,
        lastMessageAt: stats.lastMessageAt ?? null,
        createdAt: data.createdAt,
        lastSeen: presence?.lastSeen,
      };
    });
    
    console.log(`[admin/users] Returned ${users.length} users with stats from profilesStats`);
    res.json({ users });
  } catch (err: any) {
    console.error('[admin/users] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5) 房间列表（来自 RTDB /rooms）
app.get('/admin/rooms', async (_req: Request, res: Response) => {
  try {
    // ★ 修复：从 RTDB 的 /rooms 路径读取（不是 Firestore collection）
    const roomsSnap = await rtdb.ref('/rooms').get();
    const roomsData = roomsSnap.val() || {};
    
    const now = Date.now();
    const eightHoursAgo = now - (8 * 60 * 60 * 1000);
    
    const rooms = Object.entries(roomsData)
      .filter(([_, data]: [string, any]) => {
        // 过滤条件：
        // 1. 官方房间保留
        // 2. 非官方房间：未过期（expiresAt 或 createdAt + 8h > now）
        if (data.isOfficial === true) {
          return true;
        }
        
        // 用户房间检查过期时间
        const expiresAt = data.expiresAt || (data.createdAt + 8 * 60 * 60 * 1000);
        return expiresAt > now;
      })
      .map(([id, data]: [string, any]) => {
        return {
          id,
          name: data.name || '未命名房间',
          type: data.type || data.isOfficial ? 'official' : 'user',
          description: data.description || '',
          memberCount: data.memberCount || 0,
          messageCount: data.messageCount || 0,
          createdAt: data.createdAt,
          createdBy: data.createdBy || data.ownerId,
          isOfficial: data.isOfficial,
        };
      });
    
    res.json({ rooms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6) 诊断端点：检查在线状态数据
app.get('/admin/diagnostics/status', async (_req: Request, res: Response) => {
  try {
    // ★ 修复：检查正确的路径
    const presenceSnap = await rtdb.ref('/presence').get();
    const presenceData = presenceSnap.val() || {};
    
    const onlineCount = Object.entries(presenceData).filter(([_, data]: [string, any]) => {
      const now = Date.now();
      const timeout = 60 * 1000;
      const lastSeen = data?.lastSeen ?? 0;
      return data?.state === 'online' && now - lastSeen < timeout;
    }).length;
    
    res.json({ 
      onlineCount,
      totalPresenceRecords: Object.keys(presenceData).length,
      presenceData,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7) 诊断端点：检查 RTDB 数据
app.get('/admin/diagnostics/firestore', async (_req: Request, res: Response) => {
  try {
    // ★ 修复：从 RTDB 读取而不是 Firestore
    const roomsSnap = await rtdb.ref('/rooms').get();
    const profilesSnap = await rtdb.ref('/profiles').get();
    const presenceSnap = await rtdb.ref('/presence').get();
    
    res.json({
      rooms: {
        count: Object.keys(roomsSnap.val() || {}).length,
        samples: Object.entries((roomsSnap.val() || {})).slice(0, 3).map(([id, data]) => ({ id, data })),
      },
      profiles: {
        count: Object.keys(profilesSnap.val() || {}).length,
        samples: Object.entries((profilesSnap.val() || {})).slice(0, 3).map(([id, data]) => ({ id, data })),
      },
      presence: {
        count: Object.keys(presenceSnap.val() || {}).length,
        samples: Object.entries((presenceSnap.val() || {})).slice(0, 3).map(([id, data]) => ({ id, data })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9) 审核报告列表
app.get('/admin/reports', async (_req: Request, res: Response) => {
  try {
    // 获取所有报告（从 reports 集合或路径）
    const reportsSnap = await rtdb.ref('/reports').get();
    const reportsData = reportsSnap.val() || {};
    
    const reports = Object.entries(reportsData)
      .map(([id, data]: [string, any]) => {
        return {
          id,
          userId: data.userId || '未知用户',
          userName: data.userName || '未知',
          reason: data.reason || '无原因',
          status: data.status || 'pending',
          createdAt: data.createdAt || 0,
          resolvedAt: data.resolvedAt,
          resolvedBy: data.resolvedBy,
          description: data.description || '',
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // 按时间倒序
    
    res.json({ reports });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10b) 用户管理 - Ban 用户
app.post('/admin/users/:userId/ban', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    // 在全局黑名单中标记用户
    await rtdb.ref(`/globalBans/${userId}`).set({
      bannedAt: admin.database.ServerValue.TIMESTAMP,
      reason: reason || 'Banned by admin',
      bannedBy: 'admin',
    });
    
    // 从在线状态中删除
    await rtdb.ref(`/presence/${userId}`).remove();
    
    res.json({ success: true, message: `User ${userId} has been banned` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10c) 用户管理 - Kick 用户（删除在线状态）
app.post('/admin/users/:userId/kick', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // 从在线状态中删除，强制用户离线
    await rtdb.ref(`/presence/${userId}`).set({
      state: 'offline',
      lastSeen: admin.database.ServerValue.TIMESTAMP,
    });
    
    res.json({ success: true, message: `User ${userId} has been kicked` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10d) 用户管理 - Delete 用户
app.post('/admin/users/:userId/delete', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // 删除用户档案和所有相关数据
    const updates: Record<string, null> = {};
    updates[`/profiles/${userId}`] = null;
    updates[`/presence/${userId}`] = null;
    updates[`/friends/${userId}`] = null;
    updates[`/inbox/${userId}`] = null;
    updates[`/globalBans/${userId}`] = null;
    
    await rtdb.ref('/').update(updates);
    
    res.json({ success: true, message: `User ${userId} has been deleted` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10) SSE 实时流（5秒一推）
app.get('/admin/metrics/stream', async (req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = async () => {
      try {
        const snap = await db.doc('metrics/runtime').get();
        const data = snap.exists ? snap.data() : {};
        res.write(`event: tick\ndata: ${JSON.stringify({
          online: data?.onlineNow ?? 0,
          msg24h: data?.msg24h ?? 0,
          dau: data?.dau ?? 0,
          buckets: data?.buckets ?? [],
          rooms: data?.topRooms ?? [],
        })}\n\n`);
      } catch (err: any) {
        console.error('SSE send error:', err);
      }
    };

    const timer = setInterval(send, 5000);
    req.on('close', () => {
      clearInterval(timer);
      res.end();
    });
    await send(); // 立即发送一次
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SEO 工具 ============

// Sitemap 生成端点
app.post('/admin/seo/generate-sitemap', async (_req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    
    // 获取所有活跃房间
    const roomsSnap = await rtdb.ref('/rooms').get();
    const roomsData = roomsSnap.val() || {};
    
    const currentTime = Date.now();
    
    // 过滤活跃房间
    const activeRooms = Object.entries(roomsData)
      .filter(([_, data]: [string, any]) => {
        if (data.isOfficial === true) return true;
        const expiresAt = data.expiresAt || (data.createdAt + 8 * 60 * 60 * 1000);
        return expiresAt > currentTime;
      })
      .map(([id, _]) => id);
    
    // 生成 sitemap.xml 内容
    let sitemapXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemapXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // 主页 - 最高优先级
    sitemapXml += '  <url>\n';
    sitemapXml += '    <loc>https://chatsphere.live/</loc>\n';
    sitemapXml += `    <lastmod>${today}</lastmod>\n`;
    sitemapXml += '    <changefreq>daily</changefreq>\n';
    sitemapXml += '    <priority>1.0</priority>\n';
    sitemapXml += '  </url>\n';
    
    // 登录页
    sitemapXml += '  <url>\n';
    sitemapXml += '    <loc>https://chatsphere.live/login</loc>\n';
    sitemapXml += `    <lastmod>${today}</lastmod>\n`;
    sitemapXml += '    <changefreq>weekly</changefreq>\n';
    sitemapXml += '    <priority>0.8</priority>\n';
    sitemapXml += '  </url>\n';
    
    // 房间列表页面
    sitemapXml += '  <url>\n';
    sitemapXml += '    <loc>https://chatsphere.live/rooms</loc>\n';
    sitemapXml += `    <lastmod>${today}</lastmod>\n`;
    sitemapXml += '    <changefreq>hourly</changefreq>\n';
    sitemapXml += '    <priority>0.9</priority>\n';
    sitemapXml += '  </url>\n';
    
    // 直消息页面
    sitemapXml += '  <url>\n';
    sitemapXml += '    <loc>https://chatsphere.live/dm</loc>\n';
    sitemapXml += `    <lastmod>${today}</lastmod>\n`;
    sitemapXml += '    <changefreq>daily</changefreq>\n';
    sitemapXml += '    <priority>0.8</priority>\n';
    sitemapXml += '  </url>\n';
    
    // 博客页面
    sitemapXml += '  <url>\n';
    sitemapXml += '    <loc>https://chatsphere.live/blog</loc>\n';
    sitemapXml += `    <lastmod>${today}</lastmod>\n`;
    sitemapXml += '    <changefreq>weekly</changefreq>\n';
    sitemapXml += '    <priority>0.7</priority>\n';
    sitemapXml += '  </url>\n';
    
    // 隐私政策
    sitemapXml += '  <url>\n';
    sitemapXml += '    <loc>https://chatsphere.live/privacy</loc>\n';
    sitemapXml += `    <lastmod>${today}</lastmod>\n`;
    sitemapXml += '    <changefreq>monthly</changefreq>\n';
    sitemapXml += '    <priority>0.6</priority>\n';
    sitemapXml += '  </url>\n';
    
    // 服务条款
    sitemapXml += '  <url>\n';
    sitemapXml += '    <loc>https://chatsphere.live/terms</loc>\n';
    sitemapXml += `    <lastmod>${today}</lastmod>\n`;
    sitemapXml += '    <changefreq>monthly</changefreq>\n';
    sitemapXml += '    <priority>0.6</priority>\n';
    sitemapXml += '  </url>\n';
    
    // 活跃房间页面
    activeRooms.forEach(roomId => {
      sitemapXml += '  <url>\n';
      sitemapXml += `    <loc>https://chatsphere.live/r/${roomId}</loc>\n`;
      sitemapXml += `    <lastmod>${today}</lastmod>\n`;
      sitemapXml += '    <changefreq>daily</changefreq>\n';
      sitemapXml += '    <priority>0.7</priority>\n';
      sitemapXml += '  </url>\n';
    });
    
    sitemapXml += '</urlset>\n';
    
    // 计算统计信息
    const pageCount = 8 + activeRooms.length; // 8 个静态页面 + 动态房间页面
    
    res.json({
      success: true,
      message: `Sitemap generated successfully with ${pageCount} URLs (${activeRooms.length} room pages + 8 static pages)`,
      timestamp: now,
      roomCount: activeRooms.length,
      totalUrls: pageCount,
      sitemapPreview: sitemapXml.substring(0, 800) + '...',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ 定时任务 ============

// 每分钟聚合（最近 24 小时）
export const aggregateMetrics = functions.scheduler.onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'America/Los_Angeles' },
  async () => {
    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      console.log(`[aggregateMetrics] START: now=${now}, oneDayAgo=${oneDayAgo}`);

      // ★ 修复：从 RTDB /messages 读取消息而不是 Firestore
      const messagesSnap = await rtdb.ref('/messages').get();
      const messagesData = messagesSnap.val() || {};

      let msg24h = 0;
      let totalMsgCount = 0;
      let invalidTimestampCount = 0;
      let outOfRangeCount = 0;

      const buckets: { h: number; c: number }[] = Array.from({ length: 24 }, (_, i) => ({ h: i, c: 0 }));
      const roomCounts: Record<string, number> = {};

      // 遍历所有房间的消息
      Object.entries(messagesData).forEach(([roomId, messages]: [string, any]) => {
        if (!messages || typeof messages !== 'object') return;

        Object.entries(messages).forEach(([msgId, msg]: [string, any]) => {
          totalMsgCount++;
          const msgTime = msg?.createdAt;
          
          // ★ 改进：检查 msgTime 是否真的是数字
          if (typeof msgTime !== 'number' || msgTime <= 0) {
            invalidTimestampCount++;
            console.warn(`[aggregateMetrics] Invalid timestamp: room=${roomId}, msgId=${msgId}, createdAt=${msgTime}`);
            return;
          }
          
          // 只计算 24 小时内的消息
          if (msgTime >= oneDayAgo && msgTime <= now) {
            msg24h++;
            
            // 分桶统计（按本地时区小时而不是UTC，匹配服务器时区 America/Los_Angeles）
            const localDate = new Date(msgTime);
            // 获取本地时区的小时（Pacific Time）
            const localHour = localDate.getHours();
            if (localHour >= 0 && localHour < 24 && buckets[localHour]) {
              buckets[localHour].c++;
            } else {
              console.warn(`[aggregateMetrics] Invalid hour: msgTime=${msgTime}, localHour=${localHour}`);
            }
            
            // 房间消息数统计
            roomCounts[roomId] = (roomCounts[roomId] ?? 0) + 1;
          } else {
            outOfRangeCount++;
          }
        });
      });

      console.log(`[aggregateMetrics] Messages: total=${totalMsgCount}, invalid_ts=${invalidTimestampCount}, out_of_range=${outOfRangeCount}, counted=${msg24h}`);
      console.log(`[aggregateMetrics] Buckets:`, buckets);

      // 排序热门房间（取前 3）
      let topRooms = Object.entries(roomCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([roomId, count]) => ({ roomId, count }));

      // 获取房间名字（数据丰富化）
      const roomsSnap = await rtdb.ref('/rooms').get();
      const roomsData = roomsSnap.exists() ? roomsSnap.val() : {};
      
      const topRoomsWithNames: Array<{ name: string; count: number }> = topRooms.map(room => {
        const roomInfo = roomsData[room.roomId];
        const roomName = roomInfo?.name || room.roomId;  // 如果没有名字就用 ID
        return { name: roomName, count: room.count };
      });

      // 2) 写入 metrics/runtime
      await db.doc('metrics/runtime').set(
        {
          msg24h,
          buckets,
          topRooms: topRoomsWithNames,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`✓ Metrics aggregated: msg24h=${msg24h}, buckets updated, topRooms=${topRoomsWithNames.length}`);
    } catch (err: any) {
      console.error('aggregateMetrics error:', err);
    }
  }
);

// 每分钟计算在线人数
export const updateOnlineCount = functions.scheduler.onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'America/Los_Angeles' },
  async () => {
    try {
      const now = Date.now();
      const timeout = 60 * 1000; // 60秒超时

      // ★ 修复：使用正确的 /presence 路径而不是 /status
      const presenceSnap = await rtdb.ref('/presence').get();
      let onlineCount = 0;

      presenceSnap.forEach((child) => {
        const data = child.val();
        const lastSeen = data?.lastSeen ?? 0;
        if (data?.state === 'online' && now - lastSeen < timeout) {
          onlineCount++;
        }
      });

      await db.doc('metrics/runtime').set(
        { onlineNow: onlineCount, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      console.log(`✓ Online count updated: ${onlineCount}`);
    } catch (err: any) {
      console.error('updateOnlineCount error:', err);
    }
  }
);

// 每天 00:05 UTC 计算 DAU
export const calculateDailyActiveUsers = functions.scheduler.onSchedule(
  { schedule: '5 0 * * *', timeZone: 'UTC' },
  async () => {
    try {
      const now = Date.now();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);
      const dateStr = yesterday.toISOString().split('T')[0]; // yyyy-mm-dd

      console.log(`[calculateDailyActiveUsers] START for date ${dateStr}`);

      // 从 RTDB /messages 读取消息（不是 Firestore）
      const messagesSnap = await rtdb.ref('/messages').get();
      if (!messagesSnap.exists()) {
        console.log(`[DAU] No messages found for ${dateStr}, dau=0`);
        await db.doc('metrics/runtime').set(
          { dau: 0, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        return;
      }

      const messagesData = messagesSnap.val();
      const uniqueUsers = new Set<string>();
      const oneDayAgo = yesterday.getTime();
      const endTime = new Date().getTime();

      console.log(`[DAU] Time range: ${oneDayAgo} to ${endTime} (${(endTime - oneDayAgo) / 1000 / 60 / 60} hours)`);

      let totalMsgCount = 0;
      let validMsgCount = 0;
      let noAuthorCount = 0;

      // 遍历所有房间的消息
      Object.entries(messagesData).forEach(([roomId, roomMessages]: [string, any]) => {
        if (!roomMessages || typeof roomMessages !== 'object') return;

        Object.entries(roomMessages).forEach(([msgId, msg]: [string, any]) => {
          totalMsgCount++;
          const createdAt = msg?.createdAt;
          const authorId = msg?.authorId;

          // 检查时间戳类型和范围（24小时内）
          if (typeof createdAt === 'number' && createdAt >= oneDayAgo && createdAt <= endTime) {
            validMsgCount++;
            // 检查用户 ID
            if (authorId && typeof authorId === 'string') {
              uniqueUsers.add(authorId);
            } else {
              noAuthorCount++;
            }
          }
        });
      });

      const dau = uniqueUsers.size;
      console.log(`[DAU] Messages: total=${totalMsgCount}, valid_ts=${validMsgCount}, no_author=${noAuthorCount}, unique_users=${dau}`);
      console.log(`[DAU] User IDs:`, Array.from(uniqueUsers));

      await db.doc(`daily_active_users/${dateStr}`).set({ count: dau });
      await db.doc('metrics/runtime').set(
        { dau, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      
      console.log(`✓ DAU calculated for ${dateStr}: ${dau} unique users`);
    } catch (err: any) {
      console.error('calculateDailyActiveUsers error:', err);
    }
  }
);

// ============ 导出 HTTP API ============
export const api = functions.https.onRequest(app);

// ★ Message Counter Maintenance Triggers
// export { onMessageCreate, onMessageDelete }; // Temporarily disabled

// ★ One-time Backfill Script
// export { backfillUserMsgCount }; // Temporarily disabled

console.log('[deploy] counters installed');
