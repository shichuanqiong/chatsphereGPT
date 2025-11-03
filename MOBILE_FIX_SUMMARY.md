# 手机端在线用户修复 - 实现总结

## 问题

**描述**：手机端 Sidebar 无法显示在线用户数据
- 手机 Sidebar 显示："Online: 0 users" ❌
- 桌面 Home 页显示："Online: 2 users" ✅

**原因**：两端使用不同的过滤逻辑

---

## 根本原因

### 桌面端 (Home.tsx - 正确)
```typescript
// 第 603 行
const alive = Object.keys(presence).filter((k) => 
  now - (presence[k]?.lastSeen || 0) < 5 * 60 * 1000
);
```
- 只显示 `lastSeen < 5分钟` 的用户

### 手机端 (Sidebar.tsx - 错误，已修复)
```typescript
// 修复前
.filter(k => online[k].state === 'online')  // ❌ 无超时检查

// 修复后
.filter(k => {
  const lastSeen = online[k]?.lastSeen ?? 0;
  return online[k]?.state === 'online' && now - lastSeen < timeout;
})  // ✅ 与桌面端一致
```

---

## 修复内容

**文件**：`src/components/Sidebar.tsx`

**改动**：
1. `onlineUsers` 计算（第 56-62 行）
   - 添加 5 分钟超时检查
   - 与 Home.tsx 逻辑对齐

2. `onlineCount` 计算（第 64-67 行）
   - 添加 5 分钟超时检查
   - 与 Home.tsx 逻辑对齐

**关键代码**：
```typescript
const now = Date.now();
const timeout = 5 * 60 * 1000;
const lastSeen = online[k]?.lastSeen ?? 0;
return online[k]?.state === 'online' && now - lastSeen < timeout;
```

---

## 修复验证

### 修复前后对比

```
修复前：
- 手机 Sidebar: "Online: 0 users" ❌
- 桌面 Home: "Online: 2 users" ✅

修复后：
- 手机 Sidebar: "Online: 2 users" ✅
- 桌面 Home: "Online: 2 users" ✅
```

---

## 部署步骤

1. **代码已提交到 GitHub**
   - Commit: `1fbe135`
   - Message: `fix: add lastSeen timeout check to mobile sidebar online users`

2. **清除浏览器缓存**
   ```
   Ctrl+Shift+Delete 清除所有数据
   或 Ctrl+Shift+R 硬刷新
   ```

3. **测试验证**
   - 手机打开 `talkisphere.com`
   - 打开 Sidebar（左上角菜单）
   - 验证 "Online: X users" 与桌面端一致
   - 点击用户名可发起 DM

---

## 技术细节

### 为什么需要 `lastSeen` 超时检查？

`/presence/{uid}` 中的 `state` 字段可能滞后：
- 用户突然断网或关闭浏览器
- `state` 还是 `'online'` 但 `lastSeen` 是老旧的
- 仅根据 `state` 判断会显示不活跃的用户

### 5 分钟超时的选择

- 短于 5 分钟：频繁更新，服务器负载增加
- 等于 5 分钟：与 presence 心跳间隔保持一致
- 长于 5 分钟：可能显示已离线的用户

---

## 相关文件

- `MOBILE_ONLINE_USERS_FIX.md` - 详细分析文档
- `src/components/Sidebar.tsx` - 修复代码位置
- `src/pages/Home.tsx` - 参考实现（第 601-607 行）
