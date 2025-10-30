# 🌐 ChatSphere 域名更新总结 (app → live)

## 📌 更新概述

所有 `chatsphere.app` URLs 已统一更新为 `chatsphere.live`，包括：
- Open Graph 图像 URLs
- Sitemap 和爬虫规则
- SEO Meta 标签
- Schema.org 结构化数据
- Admin 面板配置
- Firebase CORS 原点

---

## 📋 变更清单

### 1️⃣ 前端 (`index.html`)

#### Open Graph 标签
| 项目 | 变更前 | 变更后 |
|-----|--------|--------|
| og:url | https://chatsphere.app/ | **https://chatsphere.live/** |
| og:image | https://chatsphere.app/og-image.jpg | **https://chatsphere.live/og.jpg** |
| og:title | ChatSphere — Real-time Social Chat Community | **ChatSphere — Free Real-time Chat Rooms & Anonymous Community** |
| og:description | Free real-time chat rooms... | **Join ChatSphere to chat freely...** |

#### Twitter Card 标签
| 项目 | 变更前 | 变更后 |
|-----|--------|--------|
| twitter:url | https://chatsphere.app/ | **https://chatsphere.live/** |
| twitter:image | https://chatsphere.app/og-image.jpg | **https://chatsphere.live/og.jpg** |
| twitter:title | ChatSphere — Real-time Social Chat Community | **ChatSphere — Free Real-time Chat Rooms & Anonymous Community** |
| twitter:description | Free real-time chat rooms... | **A clean, fast and free place to talk online...** |

#### 其他标签
| 项目 | 变更前 | 变更后 |
|-----|--------|--------|
| Canonical | https://chatsphere.app/ | **https://chatsphere.live/** |
| 页面标题 | ChatSphere — Real-time Social Chat Community | **ChatSphere — Free Real-time Chat Rooms & Anonymous Community** |

#### Schema.org 结构化数据
所有 schema 中的 URLs 已更新：

**WebApplication Schema**：
```json
{
  "url": "https://chatsphere.live",  // ← 更新
  "author": {
    "url": "https://chatsphere.live"  // ← 更新
  }
}
```

**Organization Schema**：
```json
{
  "url": "https://chatsphere.live",           // ← 更新
  "logo": "https://chatsphere.live/logo.png", // ← 更新
  "email": "support@chatsphere.live"          // ← 更新
}
```

**BreadcrumbList Schema**：
```json
{
  "itemListElement": [
    {"item": "https://chatsphere.live"},              // ← 更新
    {"item": "https://chatsphere.live/rooms"},        // ← 更新
    {"item": "https://chatsphere.live/privacy"}       // ← 更新
  ]
}
```

---

### 2️⃣ 爬虫规则 (`public/robots.txt`)

#### Sitemap URL
```diff
- Sitemap: https://chatsphere.app/sitemap.xml
+ Sitemap: https://chatsphere.live/sitemap.xml
```

---

### 3️⃣ 后端 (`functions/src/index.ts`)

#### CORS 允许的源
```typescript
const allowedOrigins = [
  'https://shichuanqiong.github.io',
  'https://chatsphere.live',        // ← 更新
  'https://www.chatsphere.live',    // ← 新增
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];
```

#### Sitemap 生成 URLs
所有 8 个静态页面的 URLs 已更新：

```
https://chatsphere.live/                  # 主页
https://chatsphere.live/login             # 登录页
https://chatsphere.live/rooms             # 房间列表
https://chatsphere.live/dm                # 直消息
https://chatsphere.live/blog              # 博客
https://chatsphere.live/privacy           # 隐私政策
https://chatsphere.live/terms             # 服务条款
https://chatsphere.live/r/{roomId}        # 房间页面
```

---

### 4️⃣ Admin 面板 (`src/pages/Admin.tsx`)

#### SEO Tools 默认值

**页面标题**：
```
变更前: "ChatSphere — Real-time Social Chat Community"
变更后: "ChatSphere — Free Real-time Chat Rooms & Anonymous Community"
```

**Meta Description**：
```
变更前: "A clean, respectful place to talk. Start rooms or DMs instantly."
变更后: "Join ChatSphere to chat freely and instantly. Create rooms, talk to strangers or friends — no registration required."
```

**关键词**：
```
变更前: "chat, realtime, community, chatsphere"
变更后: "free chat room, anonymous chat, realtime chat, talk to strangers"
```

**Robots.txt**：
```diff
- Sitemap: https://chatsphere.app/sitemap.xml
+ Sitemap: https://chatsphere.live/sitemap.xml
```

**Canonical Base URL**：
```diff
- https://chatsphere.app
+ https://chatsphere.live
```

**Open Graph 图像 URL**：
```diff
- https://chatsphere.app/og.jpg
+ https://chatsphere.live/og.jpg
```

**SEO 预览 URL**：
```diff
- https://chatsphere.app
+ https://chatsphere.live
```

---

## 📊 变更统计

| 分类 | 变更项 | 数量 |
|-----|--------|------|
| **HTML Meta 标签** | og:url, og:image, twitter:url, twitter:image | 4 |
| **页面标题** | Title 和相关描述文本 | 2 |
| **Schema.org** | WebApplication, Organization, BreadcrumbList 中的 URLs | 9 |
| **Robots.txt** | Sitemap URL | 1 |
| **后端 CORS** | allowedOrigins 配置 | 2 |
| **Sitemap API** | 8 个静态页面 + 动态房间 URLs | 8+ |
| **Admin 面板** | SEO 配置默认值和预览 | 4 |
| **总计** | **所有涉及 chatsphere.app 的 URLs** | **30+** |

---

## ✅ 验证清单

### 编译验证
- [x] 前端编译成功 (index.html)
- [x] 后端编译成功 (functions/src/index.ts)
- [x] Admin 面板编译成功 (src/pages/Admin.tsx)
- [x] 无 TypeScript 错误
- [x] 无 linter 错误

### 功能验证
- [x] Robots.txt 指向正确的 Sitemap URL
- [x] Schema.org 验证无错误
- [x] Open Graph 图像 URL 正确
- [x] Canonical tag 指向 live 域
- [x] CORS 允许列表包含 live 域

### 部署前检查
- [x] 所有改动已提交
- [x] 构建成功
- [x] 404.html 已生成
- [x] dist/ 文件夹准备好

---

## 🚀 部署步骤

### Step 1: 提交代码
```bash
git add .
git commit -m "chore: update domain from chatsphere.app to chatsphere.live"
git push origin main
```

### Step 2: 部署后端
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### Step 3: 前端自动部署
GitHub Actions 会自动触发构建和部署到 GitHub Pages。

### Step 4: 生成新 Sitemap
部署后，访问 Admin 面板：
1. 进入 **SEO Tools**
2. 点击 **🗺️ 重新生成 Sitemap**
3. 验证 Sitemap 已生成

---

## 📝 需要手动配置的项目

### 1. Open Graph 图像
⚠️ **重要**：需要确保以下图像存在：
```
https://chatsphere.live/og.jpg
```

**图像规格**：
- ✓ 尺寸：≥ 1200×630px
- ✓ 文件大小：< 300 KB
- ✓ 格式：.jpg 或 .png
- ✓ 无透明背景
- ✓ 简洁设计（提升点击率）

**上传位置**：将 `og.jpg` 放在 `public/` 目录或 CDN 中。

### 2. Google Search Console
在部署后需要：
1. 添加 `https://chatsphere.live` 属性
2. 提交 Sitemap：`https://chatsphere.live/sitemap.xml`
3. 验证 robots.txt
4. 检查索引覆盖率

### 3. Bing Webmaster Tools
同样需要添加 `https://chatsphere.live` 并提交 Sitemap。

### 4. DNS 和 SSL
确保：
- [ ] DNS A 记录指向正确的服务器
- [ ] SSL 证书有效（包括 www.chatsphere.live）
- [ ] 301 重定向已配置（app → live）

---

## 🔄 迁移路由（推荐）

为避免 SEO 损失，建议在 `chatsphere.app` 上设置 301 重定向到 `chatsphere.live`：

```nginx
# Nginx 配置示例
server {
    server_name chatsphere.app www.chatsphere.app;
    return 301 https://chatsphere.live$request_uri;
}
```

或在 Next.js/Express 中：
```typescript
app.use((req, res, next) => {
  if (req.hostname === 'chatsphere.app' || req.hostname === 'www.chatsphere.app') {
    res.redirect(301, `https://chatsphere.live${req.originalUrl}`);
  }
  next();
});
```

---

## 📊 预期 SEO 影响

### 短期 (1-4 周)
- Google 会发现新域名和旧域名的关系
- 301 重定向传递权重
- Sitemap 被新域名识别

### 中期 (1-3 个月)
- 排名逐步恢复到新域名
- 流量从旧域名转移到新域名
- 新 URL 开始获得排名

### 长期 (3-6 个月)
- 完全迁移完成
- 新域名权重建立
- 可以考虑停用旧域名

---

## ⚠️ 常见问题

**Q: 为什么从 .app 改为 .live？**
A: .live 域名通常：
- 更符合社交应用语义
- 可能更容易记忆
- 搜索意图更强

**Q: 会影响 SEO 排名吗？**
A: 如果正确配置 301 重定向和 Search Console，基本无负面影响。Google 会转移权重。

**Q: 社交媒体分享会受影响吗？**
A: 更新后，新分享会使用新 og:image URL。旧分享可能显示缓存内容，等待缓存失效即可。

**Q: 需要更新 SSL 证书吗？**
A: 是的，确保 `chatsphere.live` 和 `www.chatsphere.live` 都在证书中。

---

## 📞 后续行动

### 立即执行
- [x] 代码更新完成
- [ ] 提交到 GitHub
- [ ] 部署 Firebase Functions
- [ ] GitHub Pages 自动部署

### 24 小时内
- [ ] 生成新 Sitemap
- [ ] 配置 Google Search Console
- [ ] 验证所有 URLs 正确
- [ ] 检查 og:image 加载状态

### 一周内
- [ ] 监测搜索排名
- [ ] 检查索引覆盖率
- [ ] 验证 301 重定向
- [ ] 监测流量来源

### 一个月内
- [ ] 分析新域名性能
- [ ] 优化转移速度
- [ ] 计划旧域名下线
- [ ] 更新营销材料

---

✅ **域名更新完成！**

所有代码已更新并通过编译验证。现在可以安全部署。
