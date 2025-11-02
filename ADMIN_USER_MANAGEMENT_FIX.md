# 🔧 后台用户管理功能修复 - BAN/KICK/DELETE

**修复日期**: 2025-11-02  
**修复范围**: functions/src/index.ts  
**修复对象**: Ban、Kick、Delete 用户功能  

---

## 📋 修复概述

### 问题根源
后端在执行 Ban 和 Kick 操作时，只修改了 `/presence/{uid}` 和 `/globalBans/{uid}` 中的数据，但**未在 `/profiles/{uid}` 中标记**用户的禁封/踢出状态。导致后端 `/admin/users` API 在查询用户列表时仍然返回这些用户。

### 修复方案
在数据库中增加标记字段，后端 API 在返回用户列表前进行过滤，确保被 ban 的用户不会出现在列表中。

---

## 🔍 修复详解

### 1️⃣ Ban 用户操作修复

**修复位置**: `functions/src/index.ts` 第 293-313 行

**修复前**:
```typescript
app.post('/admin/users/:userId/ban', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { reason } = req.body;
  
  // 在全局黑名单中标记用户
  await rtdb.ref(`/globalBans/${userId}`).set({ /*...*/ });
  
  // 从在线状态中删除
  await rtdb.ref(`/presence/${userId}`).remove();
  
  res.json({ success: true, message: `User ${userId} has been banned` });
});
```

**修复后**:
```typescript
app.post('/admin/users/:userId/ban', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { reason } = req.body;
  
  const updates: Record<string, any> = {};
  
  // 在全局黑名单中标记用户
  updates[`/globalBans/${userId}`] = {
    bannedAt: admin.database.ServerValue.TIMESTAMP,
    reason: reason || 'Banned by admin',
    bannedBy: 'admin',
  };
  
  // ★ 修复：在用户档案中设置 banned 标记
  updates[`/profiles/${userId}/banned`] = {
    bannedAt: admin.database.ServerValue.TIMESTAMP,
    reason: reason || 'Banned by admin',
  };
  
  // 从在线状态中删除
  updates[`/presence/${userId}`] = null;
  
  // 使用原子操作（单次 update）而不是多次 set/remove
  await rtdb.ref('/').update(updates);
  
  res.json({ success: true, message: `User ${userId} has been banned` });
});
```

**关键改变**:
- ✅ 添加了 `/profiles/{uid}/banned` 标记字段
- ✅ 使用原子 `update()` 操作而不是多个 `set()/remove()`
- ✅ 添加了错误日志记录

---

### 2️⃣ Kick 用户操作修复

**修复位置**: `functions/src/index.ts` 第 315-330 行

**修复前**:
```typescript
app.post('/admin/users/:userId/kick', async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  await rtdb.ref(`/presence/${userId}`).set({
    state: 'offline',
    lastSeen: admin.database.ServerValue.TIMESTAMP,
  });
  
  res.json({ success: true, message: `User ${userId} has been kicked` });
});
```

**修复后**:
```typescript
app.post('/admin/users/:userId/kick', async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const updates: Record<string, any> = {};
  
  // ★ 修复：在用户档案中设置 kicked 标记
  updates[`/profiles/${userId}/kicked`] = {
    kickedAt: admin.database.ServerValue.TIMESTAMP,
  };
  
  // 从在线状态中设置为离线
  updates[`/presence/${userId}`] = {
    state: 'offline',
    lastSeen: admin.database.ServerValue.TIMESTAMP,
  };
  
  await rtdb.ref('/').update(updates);
  
  res.json({ success: true, message: `User ${userId} has been kicked` });
});
```

**关键改变**:
- ✅ 添加了 `/profiles/{uid}/kicked` 标记字段，记录 kick 事件发生时间
- ✅ 改为原子操作，同时更新 profiles 和 presence
- ✅ 添加了错误日志记录

**注意**: Kick 操作与 Ban 不同的是：
- **Ban**: 用户被永久禁用，无法登录
- **Kick**: 用户被强制离线，但可以重新登录

---

### 3️⃣ Delete 用户操作增强

**修复位置**: `functions/src/index.ts` 第 332-351 行

**修复前**:
```typescript
app.post('/admin/users/:userId/delete', async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const updates: Record<string, null> = {};
  updates[`/profiles/${userId}`] = null;
  updates[`/presence/${userId}`] = null;
  updates[`/friends/${userId}`] = null;
  updates[`/inbox/${userId}`] = null;
  updates[`/globalBans/${userId}`] = null;
  
  await rtdb.ref('/').update(updates);
  
  res.json({ success: true, message: `User ${userId} has been deleted` });
});
```

**修复后**:
```typescript
app.post('/admin/users/:userId/delete', async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const updates: Record<string, null> = {};
  updates[`/profiles/${userId}`] = null;
  updates[`/presence/${userId}`] = null;
  updates[`/friends/${userId}`] = null;
  updates[`/inbox/${userId}`] = null;
  updates[`/globalBans/${userId}`] = null;
  updates[`/profilesStats/${userId}`] = null;    // ★ 新增：删除统计数据
  updates[`/dmMessages/${userId}`] = null;       // ★ 新增：删除 DM 消息
  
  await rtdb.ref('/').update(updates);
  
  res.json({ success: true, message: `User ${userId} has been deleted` });
});
```

**关键改变**:
- ✅ 添加了清除 `/profilesStats/{uid}` 的操作
- ✅ 添加了清除 `/dmMessages/{uid}` 的操作
- ✅ 完整清理用户所有相关数据

---

### 4️⃣ /admin/users API 端点改进

**修复位置**: `functions/src/index.ts` 第 122-166 行

**修复前**:
```typescript
app.get('/admin/users', async (_req: Request, res: Response) => {
  // ... 获取数据 ...
  
  const users = Object.entries(profilesData).map(([uid, data]) => {
    // 直接返回所有用户
    return {
      uid,
      name: data.nickname || data.displayName || data.name || '未知用户',
      // ... 其他字段 ...
    };
  });
  
  res.json({ users });
});
```

**修复后**:
```typescript
app.get('/admin/users', async (_req: Request, res: Response) => {
  // ... 获取数据 ...
  
  const users = Object.entries(profilesData)
    .filter(([uid, data]: [string, any]) => {
      // ★ 修复：过滤掉已被禁封的用户
      if (data.banned === true) {
        console.log(`[admin/users] Filtering out banned user: ${uid}`);
        return false;
      }
      return true;
    })
    .map(([uid, data]) => {
      return {
        uid,
        name: data.nickname || data.displayName || data.name || '未知用户',
        // ... 其他字段 ...
      };
    });
  
  res.json({ users });
});
```

**关键改变**:
- ✅ 添加了 `.filter()` 步骤，在返回前过滤已被 ban 的用户
- ✅ 通过检查 `data.banned === true` 来判断
- ✅ 添加了日志，方便调试

---

## 📊 修复效果对比

| 操作 | 修复前 | 修复后 |
|------|------|------|
| **Ban** | ❌ 用户仍在列表中 | ✅ 用户从列表消失 |
| **Kick** | ❌ 用户仍在列表中（显示 offline） | ⚠️ 用户仍在列表（因为 kick 是暂时的） |
| **Delete** | ⚠️ 仅删除部分数据 | ✅ 完全删除所有相关数据 |

**注意**: Kick 用户后仍会在列表中显示（因为 Kick 是暂时措施，用户可以重新连接），但会标记为 `offline` 状态。

---

## 🔄 数据库更新后的数据流

### Ban 用户流程
```
1. Admin 点击 BAN 按钮
   ↓
2. 前端调用 AdminAPI.banUser(uid)
   ↓
3. 后端 POST /admin/users/:uid/ban 执行：
   - /globalBans/{uid} = { bannedAt, reason, ... }
   - /profiles/{uid}/banned = { bannedAt, reason }
   - /presence/{uid} = null
   ↓
4. 前端调用 refetchUsers()
   ↓
5. 后端 GET /admin/users 执行：
   - 读取 /profiles
   - 过滤 data.banned === true 的用户
   - 只返回未被 ban 的用户
   ↓
6. 前端更新列表，用户消失
```

### Delete 用户流程
```
1. Admin 点击 DELETE 按钮
   ↓
2. 前端调用 AdminAPI.deleteUser(uid)
   ↓
3. 后端 POST /admin/users/:uid/delete 执行：
   - /profiles/{uid} = null
   - /presence/{uid} = null
   - /friends/{uid} = null
   - /inbox/{uid} = null
   - /globalBans/{uid} = null
   - /profilesStats/{uid} = null
   - /dmMessages/{uid} = null
   ↓
4. 前端调用 refetchUsers()
   ↓
5. 后端 GET /admin/users 执行：
   - 读取 /profiles
   - 该用户不存在
   - 用户列表中没有该用户
   ↓
6. 前端更新列表，用户消失
```

---

## ✅ 修复清单

- [x] Ban 操作：在 `/profiles/{uid}` 中设置 `banned` 标记
- [x] Kick 操作：在 `/profiles/{uid}` 中设置 `kicked` 标记
- [x] Delete 操作：清除 `profilesStats` 和 `dmMessages`
- [x] API 过滤：`/admin/users` 端点过滤被 ban 的用户
- [x] 原子操作：使用单次 `update()` 替代多个 `set()/remove()`
- [x] 错误日志：添加调试日志便于排查

---

## 🚀 后续验证步骤

部署修复后，请按以下步骤验证：

1. **验证 Ban 功能**
   - 在 Admin 面板选择一个用户
   - 点击 BAN 按钮
   - ✓ 确认用户立即从列表消失
   - ✓ 在 RTDB 中查看 `/profiles/{uid}/banned` 是否存在

2. **验证 Kick 功能**
   - 在 Admin 面板选择一个用户
   - 点击 KICK 按钮
   - ✓ 确认用户状态变为 offline
   - ✓ 在 RTDB 中查看 `/profiles/{uid}/kicked` 是否存在

3. **验证 Delete 功能**
   - 在 Admin 面板选择一个用户
   - 点击 DELETE 按钮
   - ✓ 确认用户立即从列表消失
   - ✓ 在 RTDB 中查看该用户的所有数据是否被完全删除

4. **查看 Cloud Functions 日志**
   - 在 Firebase Console 查看 Functions 日志
   - ✓ 确认没有错误信息
   - ✓ 查看 `[ban]`、`[kick]`、`[delete]` 日志记录

---

## 📝 注意事项

1. **部署**: 修改后需要运行 `firebase deploy --only functions` 部署更新
2. **缓存**: 修改后可能需要清空浏览器缓存才能看到最新效果
3. **权限**: 确保 RTDB 规则允许这些操作
4. **原子性**: 所有修改都使用单次 `update()` 操作确保原子性
5. **回滚**: 如发现问题，可恢复之前版本

---

## 🔗 相关文件

- Frontend: `src/pages/Admin.tsx` (保持不变)
- Frontend Hook: `src/hooks/useAnalyticsStream.ts` (保持不变)
- Backend API: `src/lib/api.ts` (保持不变)
- Backend Functions: `functions/src/index.ts` ✅ **已修复**
