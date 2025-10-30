# ChatSphere Admin Dashboard — 快速接入指引

## 概述

Admin Dashboard 已集成到项目中，位于 `/admin` 路由。本指引涵盖：
- ✅ 路由挂载（已完成）
- 📋 访问控制 (RBAC)
- 🔌 API 接口占位
- 📊 功能清单

---

## 1️⃣ 路由挂载（已完成）

### 当前配置

```typescript
// src/App.tsx
import Admin from './pages/Admin';

<Route path='/admin' element={<Guard><Admin/></Guard>} />
```

✅ **已完成：** Admin 页面在 `/admin` 路由，通过 `<Guard>` 组件进行认证检查。

---

## 2️⃣ 访问控制（RBAC）

### 当前状态
- 前端默认角色：`role = "owner"`（硬编码在 `src/pages/Admin.tsx` 第 260 行）
- `<Guard>` 组件检查：`user != null`（仅检查认证，未检查权限）

### 接入后端步骤

#### Step 1: 扩展用户 Profile 数据结构
```typescript
// src/pages/Home.tsx 中的 Profile 类型
type Profile = {
  uid: string;
  nickname: string;
  gender: 'male'|'female';
  age: number;
  country: string;
  bio?: string;
  isGuest?: boolean;
  avatarUrl?: string;
  role?: 'owner' | 'admin' | 'moderator';  // ✨ 新增字段
  createdAt?: number;
};
```

#### Step 2: 修改 Admin.tsx 中的 role 获取
```typescript
// src/pages/Admin.tsx (当前 ~ 第 260 行)
// 当前（硬编码）：
const [role, setRole] = useState<Role>("owner");

// 改为（从 Profile 读取）：
import { useAuth } from '../auth';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role>("moderator");
  const [allowedSections, setAllowedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) return;
    
    // 从 Firebase 读取用户角色
    const unsubscribe = onValue(ref(db, `/profiles/${user.uid}`), (snap) => {
      const profile = snap.val();
      const userRole = profile?.role || "moderator";
      setRole(userRole);
      
      // 根据角色设置可见的功能模块
      const sections = getRolePermissions(userRole);
      setAllowedSections(sections);
    });
    
    return () => unsubscribe();
  }, [user?.uid]);

  // 渲染时检查权限
  if (!allowedSections.has(section)) {
    return <div className="p-6 text-red-300">❌ 您没有权限访问此模块</div>;
  }

  return ( /* ... existing JSX ... */ );
}

// 权限映射函数
function getRolePermissions(role: Role): Set<string> {
  const permissions: Record<Role, Set<string>> = {
    owner: new Set([
      'dashboard', 'users', 'rooms', 'moderation', 
      'seo', 'analytics', 'settings'
    ]),
    admin: new Set([
      'dashboard', 'users', 'rooms', 'moderation', 
      'seo', 'analytics'
    ]),
    moderator: new Set([
      'moderation', 'users' // 仅查看/操作
    ]),
  };
  return permissions[role] || new Set();
}
```

#### Step 3: 更新 Firebase Rules（权限校验）
```json
{
  "rules": {
    "profiles": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "admin": {
      "users": {
        ".read": "root.child('profiles').child(auth.uid).child('role').val() !== null",
        ".write": "root.child('profiles').child(auth.uid).child('role').val() === 'owner'"
      },
      "rooms": {
        ".read": "root.child('profiles').child(auth.uid).child('role').val() === 'admin' || root.child('profiles').child(auth.uid).child('role').val() === 'owner'",
        ".write": "root.child('profiles').child(auth.uid).child('role').val() === 'owner'"
      }
    }
  }
}
```

---

## 3️⃣ API 接口占位

### 3.1 Users 管理

#### GET /admin/users（列表）
```typescript
// Mock 已实现，替换为真实 API
const [users, setUsers] = useState<User[]>(MOCK_USERS);

useEffect(() => {
  // 替换为：
  fetch('/api/admin/users', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
    .then(r => r.json())
    .then(setUsers)
    .catch(console.error);
}, [authToken]);
```

#### POST /admin/users/:uid/ban（禁封）
```typescript
async function banUser(uid: string) {
  await fetch(`/api/admin/users/${uid}/ban`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: JSON.stringify({ reason: '...' })
  });
}
```

#### POST /admin/users/:uid/freeze（冻结）
```typescript
async function freezeUser(uid: string) {
  await fetch(`/api/admin/users/${uid}/freeze`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
}
```

#### DELETE /admin/users/:uid（删除）
```typescript
async function deleteUser(uid: string) {
  await fetch(`/api/admin/users/${uid}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
}
```

#### GET /admin/users/export/csv（导出）
```typescript
async function exportUsersCSV() {
  const res = await fetch('/api/admin/users/export/csv', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
```

---

### 3.2 Rooms 管理

#### POST /admin/rooms（创建官方房间）
```typescript
async function createOfficialRoom(name: string, description: string) {
  await fetch('/api/admin/rooms', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      description,
      visibility: 'public',
      type: 'official'
    })
  });
}
```

#### POST /admin/rooms/:roomId/announcements（公告）
```typescript
async function postAnnouncement(roomId: string, message: string) {
  await fetch(`/api/admin/rooms/${roomId}/announcements`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, postedAt: new Date().toISOString() })
  });
}
```

#### GET /admin/rooms/:roomId/export（导出聊天记录）
```typescript
async function exportRoomChat(roomId: string) {
  const res = await fetch(`/api/admin/rooms/${roomId}/export`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const blob = await res.blob();
  // 同上，创建下载链接
}
```

#### PATCH /admin/rooms/:roomId/slowmode（慢速模式）
```typescript
async function setSlowMode(roomId: string, seconds: number) {
  await fetch(`/api/admin/rooms/${roomId}/slowmode`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ seconds })
  });
}
```

---

### 3.3 Moderation

#### GET /admin/moderation/reports（举报队列）
```typescript
async function fetchReports() {
  const res = await fetch('/api/admin/moderation/reports', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return await res.json();
  // 返回格式：{ reports: [{ id, reporter, reported, reason, createdAt }, ...] }
}
```

#### POST /admin/moderation/filters（敏感词/链接配置）
```typescript
async function updateFilters(config: {
  blocked_words: string[];
  link_throttle_hours: number;
}) {
  await fetch('/api/admin/moderation/filters', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  });
}
```

---

### 3.4 SEO Tools

#### GET /admin/seo/meta（读取当前 Meta）
```typescript
async function fetchSEOMeta() {
  const res = await fetch('/api/admin/seo/meta', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return await res.json();
  // 返回：{ title, description, keywords, ogImage, twitterCard }
}
```

#### POST /admin/seo/meta（保存 Meta）
```typescript
async function saveSEOMeta(meta: {
  title: string;
  description: string;
  keywords: string;
  ogImage?: string;
}) {
  await fetch('/api/admin/seo/meta', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(meta)
  });
}
```

#### POST /admin/seo/sitemap/regenerate（重新生成 Sitemap）
```typescript
async function regenerateSitemap() {
  await fetch('/api/admin/seo/sitemap/regenerate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
}
```

#### POST /admin/seo/robots.txt（更新 robots.txt）
```typescript
async function updateRobotsTxt(content: string) {
  await fetch('/api/admin/seo/robots.txt', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  });
}
```

---

### 3.5 Analytics

#### GET /admin/analytics/overview（概览统计）
```typescript
async function fetchAnalyticsOverview() {
  const res = await fetch('/api/admin/analytics/overview', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return await res.json();
  // 返回：{ online, dau, messages, visitors_24h, signups_24h, retention_d1 }
}
```

#### GET /admin/analytics/traffic（流量来源）
```typescript
// 示例：连接 PostHog / Plausible
async function fetchTrafficBySource() {
  // 方案 1: 直接调用第三方 API（需要 API Key）
  // 方案 2: 后端代理调用，返回聚合数据
  const res = await fetch('/api/admin/analytics/traffic', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return await res.json();
  // 返回：{ google: 36, direct: 20, referral: 7 }
}
```

#### GET /admin/analytics/message-velocity（消息速率）
```typescript
async function fetchMessageVelocity() {
  const res = await fetch('/api/admin/analytics/message-velocity', {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return await res.json();
  // 返回：{ last_hour: 112, last_day: 1245, ...}
}
```

---

## 4️⃣ 功能清单

| 模块 | 功能 | 状态 | 优先级 |
|-----|------|------|--------|
| Dashboard | 在线用户/DAU/消息 | ✅ Mock | 🔴 高 |
| Users | 搜索/筛选/禁封/冻结/删除 | ✅ Mock | 🔴 高 |
| Users | 导出 CSV | ⏳ 接口占位 | 🟡 中 |
| Rooms | 创建官方房间 | ⏳ 接口占位 | 🔴 高 |
| Rooms | 公告发布 | ⏳ 接口占位 | 🟡 中 |
| Rooms | 聊天导出 | ⏳ 接口占位 | 🟢 低 |
| Moderation | 举报队列 | ⏳ 接口占位 | 🔴 高 |
| Moderation | 敏感词/链接过滤 | ⏳ 接口占位 | 🟡 中 |
| SEO | Meta 标签编辑 | ⏳ 接口占位 | 🟡 中 |
| SEO | Sitemap 生成 | ⏳ 接口占位 | 🟡 中 |
| Analytics | 概览统计 | ✅ Mock | 🔴 高 |
| Analytics | 流量/消息速率 | ⏳ 连接第三方 | 🟡 中 |
| Settings | RBAC 配置 | ⏳ 接口占位 | 🔴 高 |
| Settings | 品牌定制 | ⏳ 接口占位 | 🟢 低 |

---

## 5️⃣ 后端实现参考

### 示例：Node.js + Express
```typescript
// backend/routes/admin.ts
import express, { Request, Response } from 'express';
import { checkAdminRole } from '../middleware/auth';

const router = express.Router();

// 用户管理
router.get('/users', checkAdminRole('admin'), async (req: Request, res: Response) => {
  try {
    const users = await db.collection('users').find({}).toArray();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/users/:uid/ban', checkAdminRole('owner'), async (req: Request, res: Response) => {
  const { uid } = req.params;
  const { reason } = req.body;
  
  await db.collection('users').updateOne(
    { uid },
    { $set: { status: 'banned', bannedReason: reason, bannedAt: new Date() } }
  );
  
  res.json({ success: true });
});

// 房间管理
router.post('/rooms', checkAdminRole('owner'), async (req: Request, res: Response) => {
  const { name, description, visibility } = req.body;
  
  const room = {
    id: generateId(),
    name,
    description,
    visibility,
    type: 'official',
    createdAt: new Date(),
    createdBy: req.user.uid,
  };
  
  await db.collection('rooms').insertOne(room);
  res.json({ room });
});

// 分析统计
router.get('/analytics/overview', checkAdminRole('admin'), async (req: Request, res: Response) => {
  const online = await db.collection('presence').find({ isOnline: true }).count();
  const dau = await getDAU(); // 获取 24h 活跃用户
  const messages = await getMessageCount24h();
  
  res.json({ online, dau, messages });
});

export default router;
```

---

## 6️⃣ 快速检查清单

- [ ] 后端已实现 RBAC（`role` 字段）
- [ ] 后端已实现上述 API 端点
- [ ] 前端集成 `useAuth` 获取角色
- [ ] 前端实现 `getRolePermissions` 权限检查
- [ ] Firebase Rules 已更新（admin 集合权限）
- [ ] 测试不同角色的权限
- [ ] 上线前审核所有敏感操作日志

---

## 📞 常见问题

**Q: 如何快速测试 Admin Dashboard？**  
A: 当前使用 Mock 数据，可直接访问 `/admin`（需登录）。后端就绪后替换 API 调用即可。

**Q: 权限不足时如何处理？**  
A: 建议返回 403 错误码，前端显示友好提示，重定向回主页。

**Q: 如何审计管理员操作？**  
A: 建议后端为所有管理操作写入审计日志表，记录 `who`, `what`, `when`, `ip`。

---

## 📝 下一步

1. **后端实现** — 按优先级实现上述 API
2. **权限测试** — 创建测试账户验证 RBAC
3. **监控告警** — 为敏感操作添加告警（如大量删除用户）
4. **文档补充** — 为管理员编写操作手册

---

**版本** v1.04 | **最后更新** 2025-10-29
