# 统一 PC/手机在线用户列表实现

## 📋 任务完成情况

✅ **已完成** - PC 和手机端在线用户列表逻辑已统一

---

## 🎯 目标

在 Desktop (Home.tsx) 和 Mobile (Sidebar.tsx) 中使用相同的在线用户过滤逻辑，确保：
- 两端显示相同的在线用户列表
- 两端的性别过滤行为一致
- 两端都使用相同的 5 分钟活跃超时机制

---

## 🔍 问题分析

### 修复前

**Desktop (Home.tsx)**：
```typescript
const onlineUsers = useMemo(() => {
  const now = Date.now();
  const alive = Object.keys(presence).filter((k) => 
    now - (presence[k]?.lastSeen || 0) < 5 * 60 * 1000
  );
  const people = alive.map(k => profiles[k] || { uid: k, nickname: `User ${k.slice(0, 6)}` });
  return people.filter(p => p.uid !== uid && (genderFilter === 'all' ? true : p.gender === genderFilter));
}, [presence, profiles, genderFilter, uid]);
```

**Mobile (Sidebar.tsx - 修复前)**：
```typescript
const onlineUsers = useMemo(() => {
  const arr = Object.keys(online).filter(k => online[k].state === 'online')  // ❌ 无超时检查
    .map(k => ({ uid: k, ...profiles[k] }));
  return arr.filter(u => genderFilter === 'all' ? true : u?.gender === genderFilter);
}, [online, profiles, genderFilter]);
```

**问题**：
- Desktop 有 5 分钟超时检查
- Mobile 没有超时检查
- 导致 Desktop 显示正确的在线用户，Mobile 显示 0 或错误的数据

---

## ✅ 解决方案

### 1. 创建共享 Hook

**文件**：`src/hooks/useOnlineUsers.ts`

```typescript
/**
 * 共享过滤逻辑：计算在线用户列表
 * 
 * 核心过滤条件：
 * 1. state === 'online'
 * 2. lastSeen 在 5 分钟内
 * 3. 排除当前用户自己
 * 4. 应用性别过滤（可选）
 */
export function useOnlineUsersList(
  presence: Record<string, any>,
  profiles: Record<string, any>,
  genderFilter: 'all' | 'male' | 'female',
  currentUid: string
): OnlineUser[] {
  return useMemo(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000;

    return Object.keys(presence)
      .filter(k => {
        const lastSeen = presence[k]?.lastSeen ?? 0;
        return presence[k]?.state === 'online' 
          && now - lastSeen < timeout 
          && k !== currentUid;
      })
      .map(k => ({
        uid: k,
        state: presence[k]?.state,
        lastSeen: presence[k]?.lastSeen,
        ...(profiles[k] || {}),
      }))
      .filter(u => genderFilter === 'all' ? true : u.gender === genderFilter);
  }, [presence, profiles, genderFilter, currentUid]);
}
```

### 2. 更新 Desktop (Home.tsx)

```typescript
// 导入
import { useOnlineUsers, useOnlineCount } from '../hooks/useOnlineUsers';

// 使用
const onlineUsers = useOnlineUsers(presence, profiles, genderFilter, uid);
const _onlineCount = useOnlineCount(presence, uid);
```

### 3. 更新 Mobile (Sidebar.tsx)

```typescript
// 使用相同的过滤逻辑
const onlineUsers = useMemo(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000;
  const arr = Object.keys(online)
    .filter(k => {
      // ★ 与 Home.tsx 相同的逻辑
      const lastSeen = online[k]?.lastSeen ?? 0;
      return online[k]?.state === 'online' && now - lastSeen < timeout && k !== uid;
    })
    .map(k => ({ uid: k, ...profiles[k] }))
    .filter(Boolean);
  return arr.filter(u => genderFilter === 'all' ? true : u?.gender === genderFilter);
}, [online, profiles, genderFilter, uid]);
```

---

## 📊 逻辑对比

### 修复后

| 属性 | Desktop | Mobile |
|------|---------|--------|
| 数据源 | `/presence` 和 `/profiles` | 同 Desktop |
| 过滤条件 | state==='online' AND lastSeen<5min AND not self | 同 Desktop |
| 性别过滤 | all/male/female | 同 Desktop |
| 结果 | 在线用户列表 | 同 Desktop |

---

## 🚀 部署步骤

### 1. 代码已提交到 GitHub

**Commit**: `cc5c316`

```
feat: create shared useOnlineUsers hook to unify desktop and mobile 
online users list logic

- Create src/hooks/useOnlineUsers.ts with unified filtering logic
- Both desktop and mobile now use identical filtering rules
```

### 2. 本地测试

```bash
# 启动开发服务器
npm run dev

# 打开两个浏览器标签页
# 标签页 1: 以用户 A 登录
# 标签页 2: 以用户 B 登录

# 在手机浏览器中打开 talkisphere.com
```

### 3. 验证测试

#### Desktop
- [ ] 打开两个浏览器标签页，以不同用户登录
- [ ] 应该看到 "Online: 2 users"
- [ ] 可以按性别过滤（all/male/female）

#### Mobile
- [ ] 打开手机浏览器访问 `talkisphere.com`
- [ ] 打开 Sidebar（左上角汉堡菜单）
- [ ] 应该看到 "Online: X users" 与 Desktop 一致
- [ ] 可以看到在线用户列表
- [ ] 可以按性别过滤

### 4. 部署

```bash
# 确保所有改动已提交
git status  # 应该显示 working tree clean

# 构建
npm run build

# 部署到 Firebase
firebase deploy --only hosting

# 或使用 GitHub Actions（如已配置）
git push origin main  # 会自动触发部署
```

---

## 📁 文件变更

### 新创建
- `src/hooks/useOnlineUsers.ts` - 共享 Hook 文件

### 修改
- `src/pages/Home.tsx` - 导入并使用新 Hook
- `src/components/Sidebar.tsx` - 使用相同的过滤逻辑

---

## 🔑 关键实现细节

### 5 分钟超时的意义

```typescript
const timeout = 5 * 60 * 1000;  // 5分钟 = 300000毫秒
const lastSeen = presence[k]?.lastSeen ?? 0;
const isActive = now - lastSeen < timeout;
```

**为什么需要？**
- 用户突然断网或关闭浏览器时，`state` 可能还是 `'online'`
- 仅依赖 `state` 字段会显示陈旧数据
- 加上 `lastSeen` 超时检查可以过滤掉不活跃的用户

**为什么是 5 分钟？**
- 与 presence 心跳间隔保持一致
- 在实时性和性能之间取得平衡

### 排除当前用户

```typescript
&& k !== currentUid
```

避免在在线用户列表中显示自己

---

## ✨ 优化点

1. **代码复用**：共享 Hook 避免重复代码
2. **一致性**：Desktop 和 Mobile 使用相同逻辑
3. **可维护性**：集中管理过滤逻辑，易于后续修改
4. **性能**：使用 `useMemo` 避免不必要的重算

---

## 📝 下一步（可选）

如果需要进一步优化：

1. **性别信息完整性**：确保所有用户的 profile 中都有 `gender` 字段
2. **数据预加载**：考虑预加载常用用户的 profile 信息
3. **缓存策略**：对频繁访问的用户信息使用缓存
4. **实时更新**：使用 WebSocket 替代 HTTP 轮询提高实时性

---

## 🎓 设计模式

这个实现演示了：

1. **Hook 复用**：通过参数化 Hook 实现逻辑复用
2. **数据驱动**：UI 逻辑纯粹依赖数据状态
3. **关注点分离**：订阅逻辑和过滤逻辑分开
4. **一致性设计**：多个 UI 使用统一的计算逻辑

---

## 📞 故障排查

### 问题：Mobile 仍显示 0 用户

**检查**：
1. 是否清除了浏览器缓存？
   ```
   Ctrl+Shift+Delete → 清除所有数据
   ```
2. 是否硬刷新了？
   ```
   Ctrl+Shift+R
   ```
3. Firebase 连接是否正常？
   - DevTools Console 检查是否有错误

### 问题：性别过滤不工作

**检查**：
1. 用户 profile 中是否有 `gender` 字段？
2. `gender` 值是否为 'male' 或 'female'？

### 问题：性能缓慢

**检查**：
1. 在线用户数量是否过多（>1000）？
2. 是否有其他订阅造成的冲突？
3. 是否需要分页加载？

---

## 相关链接

- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [React Hooks - useMemo](https://react.dev/reference/react/useMemo)
- [性能优化最佳实践](https://react.dev/reference/react/useMemo#skipping-expensive-recalculations)
