# ChatSphere — SEO Tools Integration Guide

## 概述

SEO Tools 是 ChatSphere Admin Dashboard 的一个完整模块，用于管理网站 SEO 配置、实时指标和搜索引擎优化。

## 功能清单

✅ **SEO 元数据管理**
- 页面标题 (Title)
- 元描述 (Meta Description)
- 关键词 (Keywords)
- 规范 URL (Canonical)
- Open Graph 标签
- Twitter Card 配置

✅ **Robots.txt 编辑**
- 直接编辑爬虫规则
- 实时生效

✅ **Sitemap 生成**
- 一键重新生成 sitemap.xml

✅ **实时指标**
- 在线用户数
- 24 小时消息数
- DAU (每日活跃用户)
- 消息趋势图表 (SSE 实时流)

## 前端集成

### 1. 已安装依赖

```bash
pnpm add react-helmet-async recharts framer-motion lucide-react
```

### 2. 文件结构

```
src/
├── seo/
│   └── SeoProvider.tsx          # SEO 配置上下文 + Helmet
├── pages/admin/
│   └── SeoToolsPage.tsx         # SEO 工具页面 UI
├── hooks/
│   └── useAnalyticsStream.ts    # 实时指标流 hook
└── pages/
    └── Admin.tsx                 # 主 Admin Dashboard (集成 SEO)
```

### 3. 在 main.tsx 中集成 SeoProvider

```typescript
import { SeoProvider } from './seo/SeoProvider';

ReactDOM.render(
  <SeoProvider>
    <App />
  </SeoProvider>,
  document.getElementById('root')
);
```

### 4. 使用 SEO 配置 Hook

```typescript
import { useSeo } from '@/seo/SeoProvider';

function MyComponent() {
  const { cfg, refresh } = useSeo();
  // cfg.title, cfg.description, etc.
}
```

### 5. 实时指标 Hook

```typescript
import { useAnalyticsStream } from '@/hooks/useAnalyticsStream';

function Analytics() {
  const { data, connected } = useAnalyticsStream();
  // data.online, data.msg24h, data.dau, data.points
  // connected: boolean (SSE 连接状态)
}
```

## 后端集成 (Express 示例)

### 1. 安装 Express 依赖

```bash
npm install express cors body-parser
```

### 2. SEO 配置 API

```typescript
// server/routes/adminSeo.ts
import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const adminSeo = Router();

// 内存存储 (生产应改用数据库)
let seoStore = {
  title: 'ChatSphere — Real-time Social Chat Community',
  description: 'A clean, respectful place to talk.',
  keywords: 'chat, realtime, community',
  canonicalBase: 'https://chatsphere.app',
  ogImage: 'https://chatsphere.app/og.jpg',
  twitterCard: 'summary_large_image',
  robotsTxt: 'User-agent: *\nDisallow: /admin',
};

// GET /api/admin/seo
adminSeo.get('/seo', (_req, res) => {
  res.json(seoStore);
});

// PUT /api/admin/seo
adminSeo.put('/seo', (req, res) => {
  seoStore = { ...seoStore, ...req.body };
  // 可选：保存到数据库
  res.json({ ok: true });
});

// POST /api/admin/seo/sitemap:regenerate
adminSeo.post('/seo/sitemap:regenerate', (_req, res) => {
  const urls = ['/', '/blog', '/rooms', '/privacy'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${seoStore.canonicalBase}${u}</loc></url>`).join('\n')}
</urlset>`;
  
  fs.writeFileSync(path.join(__dirname, '../../public/sitemap.xml'), xml);
  res.json({ ok: true });
});

// GET /api/admin/robots.txt
adminSeo.get('/robots.txt', (_req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(seoStore.robotsTxt);
});
```

### 3. 实时指标 SSE 流

```typescript
// server/routes/metricsStream.ts
import { Router } from 'express';

export const metricsRouter = Router();

metricsRouter.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  function push() {
    const payload = {
      online: 20 + Math.floor(Math.random() * 20),
      msg24h: 5000 + Math.floor(Math.random() * 800),
      dau: 120 + Math.floor(Math.random() * 20),
      points: Array.from({ length: 12 }).map((_, i) => ({
        t: `${i * 2}:00`,
        v: 200 + Math.floor(Math.random() * 1400),
      })),
    };
    res.write(`event: snapshot\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  const id = setInterval(push, 4000);
  push();

  req.on('close', () => clearInterval(id));
});
```

### 4. 在主服务器中挂载路由

```typescript
// server.ts
import express from 'express';
import { adminSeo } from './routes/adminSeo';
import { metricsRouter } from './routes/metricsStream';

const app = express();

app.use(express.json());
app.use('/api/admin', adminSeo);
app.use('/api/admin/metrics', metricsRouter);

// 静态 sitemap 和 robots
app.get('/sitemap.xml', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/sitemap.xml'));
});

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
```

## 使用说明

### 前端使用

1. **打开 Admin 面板** - `Ctrl+Shift+A` 快捷键
2. **登录** - 用户名: `admin`, 密码: `Chatadmin2025$`
3. **导航到 SEO Tools** - 点击左侧边栏的 "SEO Tools" 选项
4. **编辑 SEO 配置** - 修改表单内容
5. **保存** - 点击 "💾 保存配置" 按钮
6. **查看预览** - 底部显示 Google Search 预览

### 实时指标

- Analytics 页面显示实时在线用户数、消息数等
- 绿色点 (🟢) 表示 SSE 连接已建立
- 如果无连接，显示默认假数据

## 生产部署建议

1. **数据持久化** - 将 SEO 配置存储到数据库而非内存
2. **权限验证** - 添加 Admin 权限检查中间件
3. **错误处理** - 完善 API 错误响应
4. **缓存** - 对 SEO 配置添加缓存层
5. **日志** - 记录所有 SEO 配置变更
6. **备份** - 定期备份 Sitemap 和配置

## 架构图

```
Frontend                    Backend
┌─────────────────┐         ┌──────────────────┐
│ SeoProvider     │────────▶│ /api/admin/seo   │
│ (react-helmet)  │         │ (GET/PUT)        │
└─────────────────┘         └──────────────────┘

┌─────────────────┐         ┌──────────────────┐
│ useAnalytics    │         │ /api/admin/      │
│ Stream (SSE)    │◀────────│ metrics/stream   │
│                 │         │ (SSE EventSource)│
└─────────────────┘         └──────────────────┘

┌─────────────────┐         ┌──────────────────┐
│ Admin Dashboard │────────▶│ /api/admin/seo/  │
│ (UI)            │         │ sitemap:regen    │
└─────────────────┘         └──────────────────┘
```

## 常见问题

**Q: SEO 配置保存失败？**
A: 检查后端 `/api/admin/seo` 是否正确实现，或切换到 mock 模式。

**Q: 实时指标不更新？**
A: 检查 `/api/admin/metrics/stream` SSE 端点，或查看浏览器控制台错误。

**Q: Sitemap 生成失败？**
A: 确保 `public/` 目录存在且可写。

## 下一步

- 集成真实用户数据源
- 添加关键词排名跟踪
- 实现 Google Search Console 集成
- 添加页面性能指标 (Core Web Vitals)
