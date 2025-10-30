import * as functions from 'firebase-functions/v2';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
// Initialize
admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();
// Express App
const app = express();
const allowedOrigins = [
    'https://shichuanqiong.github.io',
    'https://chatsphere.app',
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
// ★ Admin Key - 从环境变量读取（runtime config 通过 process.env 注入）
const ADMIN_KEY = (() => {
    // Firebase runtime config 会被自动注入到 process.env
    // 格式: process.env.ADMIN_KEY（如果用 firebase functions:config:set）
    // 或通过 Secret Manager（新推荐方式）
    const envKey = process.env.ADMIN_KEY;
    if (envKey) {
        console.log('[INIT] ✓ ADMIN_KEY from process.env.ADMIN_KEY');
        console.log('[INIT] Key length:', envKey.length);
        console.log('[INIT] First 10 chars:', envKey.substring(0, 10));
        console.log('[INIT] Last 10 chars:', envKey.substring(envKey.length - 10));
        return envKey;
    }
    // 备用：硬编码（本地开发）
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
app.use((req, res, next) => {
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
app.get('/admin/metrics/summary', async (_req, res) => {
    try {
        const snap = await db.doc('metrics/runtime').get();
        const data = snap.exists ? snap.data() : {};
        res.json({
            online: data?.onlineNow ?? 0,
            msg24h: data?.msg24h ?? 0,
            dau: data?.dau ?? 0,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 2) 24小时消息分桶
app.get('/admin/metrics/messages24h', async (_req, res) => {
    try {
        const snap = await db.doc('metrics/runtime').get();
        const data = snap.exists ? snap.data() : {};
        res.json({ buckets: data?.buckets ?? [] });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 3) 热门房间
app.get('/admin/metrics/top-rooms', async (_req, res) => {
    try {
        const snap = await db.doc('metrics/runtime').get();
        const data = snap.exists ? snap.data() : {};
        res.json({ rooms: data?.topRooms ?? [] });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 4) 用户列表（来自 RTDB /profiles）
app.get('/admin/users', async (_req, res) => {
    try {
        // ★ 修复：从 RTDB 的 /profiles 路径读取用户（不是 Firestore collection）
        const profilesSnap = await rtdb.ref('/profiles').get();
        const profilesData = profilesSnap.val() || {};
        // 同时获取在线状态
        const presenceSnap = await rtdb.ref('/presence').get();
        const presenceData = presenceSnap.val() || {};
        const now = Date.now();
        const timeout = 60 * 1000;
        const users = Object.entries(profilesData).map(([uid, data]) => {
            const presence = presenceData[uid];
            const lastSeen = presence?.lastSeen ?? 0;
            const isOnline = presence?.state === 'online' && now - lastSeen < timeout;
            return {
                uid,
                name: data.nickname || data.displayName || data.name || '未知用户',
                email: data.email || '',
                status: isOnline ? 'online' : 'offline',
                messageCount: data.messageCount || 0,
                createdAt: data.createdAt,
                lastSeen: presence?.lastSeen,
            };
        });
        res.json({ users });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 5) 房间列表（来自 RTDB /rooms）
app.get('/admin/rooms', async (_req, res) => {
    try {
        // ★ 修复：从 RTDB 的 /rooms 路径读取（不是 Firestore collection）
        const roomsSnap = await rtdb.ref('/rooms').get();
        const roomsData = roomsSnap.val() || {};
        const now = Date.now();
        const eightHoursAgo = now - (8 * 60 * 60 * 1000);
        const rooms = Object.entries(roomsData)
            .filter(([_, data]) => {
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
            .map(([id, data]) => {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 6) 诊断端点：检查在线状态数据
app.get('/admin/diagnostics/status', async (_req, res) => {
    try {
        // ★ 修复：检查正确的路径
        const presenceSnap = await rtdb.ref('/presence').get();
        const presenceData = presenceSnap.val() || {};
        const onlineCount = Object.entries(presenceData).filter(([_, data]) => {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 7) 诊断端点：检查 RTDB 数据
app.get('/admin/diagnostics/firestore', async (_req, res) => {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 9) 审核报告列表
app.get('/admin/reports', async (_req, res) => {
    try {
        // 获取所有报告（从 reports 集合或路径）
        const reportsSnap = await rtdb.ref('/reports').get();
        const reportsData = reportsSnap.val() || {};
        const reports = Object.entries(reportsData)
            .map(([id, data]) => {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 10b) 用户管理 - Ban 用户
app.post('/admin/users/:userId/ban', async (req, res) => {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 10c) 用户管理 - Kick 用户（删除在线状态）
app.post('/admin/users/:userId/kick', async (req, res) => {
    try {
        const { userId } = req.params;
        // 从在线状态中删除，强制用户离线
        await rtdb.ref(`/presence/${userId}`).set({
            state: 'offline',
            lastSeen: admin.database.ServerValue.TIMESTAMP,
        });
        res.json({ success: true, message: `User ${userId} has been kicked` });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 10d) 用户管理 - Delete 用户
app.post('/admin/users/:userId/delete', async (req, res) => {
    try {
        const { userId } = req.params;
        // 删除用户档案和所有相关数据
        const updates = {};
        updates[`/profiles/${userId}`] = null;
        updates[`/presence/${userId}`] = null;
        updates[`/friends/${userId}`] = null;
        updates[`/inbox/${userId}`] = null;
        updates[`/globalBans/${userId}`] = null;
        await rtdb.ref('/').update(updates);
        res.json({ success: true, message: `User ${userId} has been deleted` });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 10) SSE 实时流（5秒一推）
app.get('/admin/metrics/stream', async (req, res) => {
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
            }
            catch (err) {
                console.error('SSE send error:', err);
            }
        };
        const timer = setInterval(send, 5000);
        req.on('close', () => {
            clearInterval(timer);
            res.end();
        });
        await send(); // 立即发送一次
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============ SEO 工具 ============
// Sitemap 生成端点
app.post('/admin/seo/generate-sitemap', async (_req, res) => {
    try {
        const now = new Date().toISOString();
        // 获取所有活跃房间
        const roomsSnap = await rtdb.ref('/rooms').get();
        const roomsData = roomsSnap.val() || {};
        const currentTime = Date.now();
        const eightHoursAgo = currentTime - (8 * 60 * 60 * 1000);
        // 过滤活跃房间
        const activeRooms = Object.entries(roomsData)
            .filter(([_, data]) => {
            if (data.isOfficial === true)
                return true;
            const expiresAt = data.expiresAt || (data.createdAt + 8 * 60 * 60 * 1000);
            return expiresAt > currentTime;
        })
            .map(([id, _]) => id);
        // 生成 sitemap.xml 内容
        let sitemapXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        sitemapXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        // 主页
        sitemapXml += '  <url>\n';
        sitemapXml += '    <loc>https://chatsphere.app/</loc>\n';
        sitemapXml += `    <lastmod>${now}</lastmod>\n`;
        sitemapXml += '    <changefreq>daily</changefreq>\n';
        sitemapXml += '    <priority>1.0</priority>\n';
        sitemapXml += '  </url>\n';
        // 登录页
        sitemapXml += '  <url>\n';
        sitemapXml += '    <loc>https://chatsphere.app/login</loc>\n';
        sitemapXml += `    <lastmod>${now}</lastmod>\n`;
        sitemapXml += '    <changefreq>weekly</changefreq>\n';
        sitemapXml += '    <priority>0.8</priority>\n';
        sitemapXml += '  </url>\n';
        // 博客
        sitemapXml += '  <url>\n';
        sitemapXml += '    <loc>https://chatsphere.app/blog</loc>\n';
        sitemapXml += `    <lastmod>${now}</lastmod>\n`;
        sitemapXml += '    <changefreq>weekly</changefreq>\n';
        sitemapXml += '    <priority>0.9</priority>\n';
        sitemapXml += '  </url>\n';
        // 活跃房间页面
        activeRooms.forEach(roomId => {
            sitemapXml += '  <url>\n';
            sitemapXml += `    <loc>https://chatsphere.app/r/${roomId}</loc>\n`;
            sitemapXml += `    <lastmod>${now}</lastmod>\n`;
            sitemapXml += '    <changefreq>daily</changefreq>\n';
            sitemapXml += '    <priority>0.7</priority>\n';
            sitemapXml += '  </url>\n';
        });
        sitemapXml += '</urlset>\n';
        // 保存到 Firestore 或返回
        res.json({
            success: true,
            message: `Sitemap generated successfully with ${activeRooms.length} rooms`,
            timestamp: now,
            roomCount: activeRooms.length,
            sitemapPreview: sitemapXml.substring(0, 500) + '...',
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============ 定时任务 ============
// 每分钟聚合（最近 24 小时）
export const aggregateMetrics = functions.scheduler.onSchedule({ schedule: 'every 1 minutes', timeZone: 'America/Los_Angeles' }, async () => {
    try {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        // 1) 聚合消息数量 & 分桶 & 热门房间
        const messagesSnap = await db
            .collection('messages')
            .where('ts', '>=', admin.firestore.Timestamp.fromMillis(oneDayAgo))
            .get();
        let msg24h = 0;
        const buckets = Array.from({ length: 24 }, (_, i) => ({ h: i, c: 0 }));
        const roomCounts = {};
        messagesSnap.forEach((doc) => {
            msg24h++;
            const data = doc.data();
            const ts = data.ts.toMillis();
            const hour = new Date(ts).getHours();
            buckets[hour].c++;
            if (data.roomId) {
                roomCounts[data.roomId] = (roomCounts[data.roomId] ?? 0) + 1;
            }
        });
        // 排序热门房间（取前 3）
        const topRooms = Object.entries(roomCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([roomId, count]) => ({ name: roomId, count })); // 可后续加房间名
        // 2) 写入 metrics/runtime
        await db.doc('metrics/runtime').set({
            msg24h,
            buckets,
            topRooms,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`✓ Metrics aggregated: msg24h=${msg24h}, buckets updated, topRooms=${topRooms.length}`);
    }
    catch (err) {
        console.error('aggregateMetrics error:', err);
    }
});
// 每分钟计算在线人数
export const updateOnlineCount = functions.scheduler.onSchedule({ schedule: 'every 1 minutes', timeZone: 'America/Los_Angeles' }, async () => {
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
        await db.doc('metrics/runtime').set({ onlineNow: onlineCount, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        console.log(`✓ Online count updated: ${onlineCount}`);
    }
    catch (err) {
        console.error('updateOnlineCount error:', err);
    }
});
// 每天 00:05 UTC 计算 DAU
export const calculateDailyActiveUsers = functions.scheduler.onSchedule({ schedule: '5 0 * * *', timeZone: 'UTC' }, async () => {
    try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const dateStr = yesterday.toISOString().split('T')[0]; // yyyy-mm-dd
        // 昨天的消息
        const messagesSnap = await db
            .collection('messages')
            .where('ts', '>=', admin.firestore.Timestamp.fromDate(yesterday))
            .where('ts', '<', admin.firestore.Timestamp.fromDate(now))
            .get();
        const uniqueUsers = new Set();
        messagesSnap.forEach((doc) => {
            const data = doc.data();
            if (data.userId) {
                uniqueUsers.add(data.userId);
            }
        });
        const dau = uniqueUsers.size;
        // 写入 daily_active_users/{date}
        await db.doc(`daily_active_users/${dateStr}`).set({ count: dau });
        // 同时更新 metrics/runtime.dau
        await db.doc('metrics/runtime').set({ dau, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        console.log(`✓ DAU calculated for ${dateStr}: ${dau}`);
    }
    catch (err) {
        console.error('calculateDailyActiveUsers error:', err);
    }
});
// ============ 导出 HTTP API ============
export const api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map