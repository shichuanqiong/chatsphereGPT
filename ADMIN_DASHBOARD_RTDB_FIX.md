# Admin Dashboard Firebase RTDB Data Alignment Fix

## 📋 问题汇总

### 原问题列表
1. **Admin Dashboard 显示零值** - 所有统计数据（Online now、Total Users、Messages、DAU、Rooms）都显示 0
2. **数据源错误** - 原代码试图从不存在的 `/adminStats` 或 `/analytics` 路径读取数据
3. **手机端看不到在线用户** - 在线用户列表在桌面可见，但手机上不显示

---

## ✅ 解决方案

### 第一部分：Admin Dashboard 数据源修复

#### 问题根源
- Admin Dashboard 原本试图从 Firestore 的 `metrics/runtime` 或不存在的 RTDB 路径读取数据
- 实际数据存储在标准的 RTDB 节点中：
  - `/profiles` → 用户列表
  - `/presence` → 在线状态
  - `/rooms` → 房间列表
  - `/messages` → 消息（用于统计 24h 消息数和 DAU）

#### 修复方案

**1. 新建 `src/lib/adminDataService.ts`**

```typescript
export async function getAdminStats() {
  // 1) Total Users → /profiles 的子项数量
  const totalUsers = Object.keys(profiles).length;

  // 2) Online now → /presence 中 state === "online" 的数量
  const onlineNow = Object.values(presence).filter(
    (u: any) => u && u.state === 'online'
  ).length;

  // 3) Active Rooms → /rooms 的子项数量
  const activeRooms = Object.keys(rooms).length;

  // 4) Messages (24h) → 扫描 /messages 中过去 24 小时的所有消息
  // 5) DAU → 过去 24 小时内发送过消息的唯一用户数
}
```

**2. 新建 Hook `useAdminStats()` 在 `src/hooks/useAnalyticsStream.ts`**

```typescript
export function useAdminStats() {
  const [stats, setStats] = useState<{
    totalUsers: number;
    onlineNow: number;
    activeRooms: number;
    messages24h: number;
    dau: number;
  } | null>(null);

  // 每 30 秒自动刷新一次
  useEffect(() => {
    const fetchStats = async () => {
      const data = await getAdminStats();
      setStats(data);
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return { stats, loading, error };
}
```

**3. 修改 `src/pages/Admin.tsx`**

- 添加导入：`import { useAdminStats } from "@/hooks/useAnalyticsStream"`
- 调用 hook：`const { stats: adminStats } = useAdminStats()`
- 修改显示：
  ```tsx
  <Stat title="Online now" value={String(adminStats?.onlineNow ?? 0)} />
  <Stat title="Total Users" value={String(adminStats?.totalUsers ?? 0)} />
  <Stat title="Active Rooms" value={String(adminStats?.activeRooms ?? 0)} />
  <Stat title="Messages (24h)" value={String(adminStats?.messages24h ?? 0)} />
  <Stat title="DAU" value={String(adminStats?.dau ?? 0)} />
  ```

#### 数据流图
```
Admin Dashboard (src/pages/Admin.tsx)
           ↓
    useAdminStats() hook
           ↓
getAdminStats() from adminDataService.ts
           ↓
Firebase RTDB:
  ✓ /profiles → totalUsers
  ✓ /presence → onlineNow
  ✓ /rooms → activeRooms
  ✓ /messages → messages24h, dau
```

---

### 第二部分：手机端在线用户可见性

#### 问题诊断

用户报告：
- **桌面端**：在线用户列表正常显示（3 个在线用户）
- **手机端**：看不到在线用户列表，但可以：
  - 看到房间内其他用户的消息
  - 发送消息并看到桌面端收到

#### 根本原因分析

**已验证代码正确性**：
1. ✅ `firebase.ts` 中 `presenceOnline()` 和 `startPresenceHeartbeat()` 实现正确
2. ✅ `Home.tsx` 中在线用户过滤逻辑正确：
   ```typescript
   const onlineUsers = useMemo(() => {
     const now = Date.now();
     const alive = Object.keys(presence).filter((k) => 
       now - (presence[k]?.lastSeen || 0) < 5 * 60 * 1000
     );
     const people = alive.map((k) => 
       profiles[k] || { uid: k, nickname: `User ${k.slice(0, 6)}` }
     ).filter(Boolean) as Profile[];
     return people.filter((p) => 
       p.uid !== uid && (genderFilter === 'all' ? true : p.gender === genderFilter)
     );
   }, [presence, profiles, genderFilter, uid]);
   ```
3. ✅ 没有 `isGuest` 过滤器排除手机/guest 用户
4. ✅ Sidebar 中的在线用户渲染（第 165 行）也正确

**可能的手机端问题**：
- 浏览器在后台时 JS 被冻结 → presence 心跳断掉 → 手机端显示为离线
- Sidebar 的样式问题（抽屉菜单在手机上是隐藏的）
- 浏览器 localStorage/sessionStorage 的权限问题

#### 解决建议

**快速测试**：

1. 打开两个浏览器（或一个浏览器 + 一部手机）
2. 分别登录为不同用户
3. 在手机上打开 Sidebar（点击左上角汉堡菜单）
4. 检查"Online Users"部分是否显示桌面用户

**如果手机仍看不到**：

- 检查浏览器控制台是否有错误
- 验证手机能否成功 POST 到 `/presence/{uid}` 并更新 lastSeen
- 确认手机 presence 记录中的 `state` 确实是 `"online"`（而不是其他值）

**Debug 代码**（在浏览器控制台运行）：

```javascript
// 检查 presence 数据
import { ref, get, getDatabase } from 'firebase/database';
const db = getDatabase();
const presenceSnap = await get(ref(db, '/presence'));
console.log('Presence data:', presenceSnap.val());

// 检查当前用户在线状态
const myUid = window._uid;
const myPresence = await get(ref(db, `/presence/${myUid}`));
console.log('My presence:', myPresence.val());
```

---

## 🚀 部署与测试

### 部署步骤
```bash
# 1. 提交更改
git add -A
git commit -m "feat: add direct RTDB admin data service"
git push

# 2. 本地测试
npm run dev

# 3. 访问 Admin Dashboard
# 打开两个浏览器标签页，分别登录
# 访问 http://localhost:5173/#/admin
# 查看 Dashboard 统计卡片是否显示正确数值
```

### 测试检查清单

- [ ] Dashboard 显示正确的 Online now（应为活跃浏览器数）
- [ ] Total Users 显示 /profiles 中的用户数
- [ ] Active Rooms 显示 /rooms 中的房间数
- [ ] Messages (24h) 显示过去 24 小时的消息总数
- [ ] DAU 显示过去 24 小时的活跃用户数
- [ ] 在线用户列表在桌面 Sidebar 显示
- [ ] 在线用户列表在手机 Sidebar（抽屉菜单）显示

---

## 📊 数据验证

### 预期行为示例

**场景**：两个浏览器标签页，都登录为 guest 用户

| 指标 | 预期值 | 说明 |
|------|--------|------|
| Online now | 2 | 两个浏览器都在线 |
| Total Users | ≥ 2 | 至少有两个用户记录 |
| Active Rooms | ≥ 1 | 至少有一个房间（TalkiSphere 官方房间） |
| Messages (24h) | ≥ 1 | 如果有发送消息 |
| DAU | ≥ 1 | 有用户活动 |

---

## 🔍 关键文件

| 文件 | 作用 |
|------|------|
| `src/lib/adminDataService.ts` | ★ 新增 - 直接读取 RTDB 的管理统计服务 |
| `src/hooks/useAnalyticsStream.ts` | ★ 新增 hook useAdminStats |
| `src/pages/Admin.tsx` | 已修改 - 使用新的 adminStats |
| `src/firebase.ts` | Presence 管理（无需修改） |
| `src/pages/Home.tsx` | 在线用户列表逻辑（无需修改） |

---

## 📝 注意事项

### 性能考虑
- `getAdminStats()` 在首次加载时会扫描 `/messages` 的所有消息（可能较慢）
- 如果消息量很大，考虑优化到 Cloud Functions
- 当前 30 秒刷新间隔已足够大多数用途

### 手机端最佳实践
- 确保手机浏览器未启用"低功耗模式"（会冻结 JS）
- 保持应用标签页在前台（后台会冻结心跳）
- 检查浏览器是否允许后台 JavaScript 执行

---

## 📞 故障排查

如果 Admin Dashboard 仍显示 0：

1. **检查 Firebase 连接**
   ```javascript
   // 在控制台运行
   import { ref, get, getDatabase } from 'firebase/database';
   const db = getDatabase();
   const test = await get(ref(db, '/profiles'));
   console.log('Profiles data exists:', test.exists());
   ```

2. **查看浏览器控制台**
   - 搜索 `[adminDataService]` 开头的日志
   - 查看是否有错误信息

3. **重启 dev 服务器**
   ```bash
   npm run dev
   ```

4. **清除缓存**
   - Ctrl+Shift+Delete 清除浏览器缓存
   - 重新加载页面

---

## 📚 参考

- Firebase RTDB 文档：https://firebase.google.com/docs/database
- presence 心跳实现：`src/firebase.ts` 第 80-104 行
- 在线用户列表：`src/pages/Home.tsx` 第 600-607 行
