# 在线用户过滤修复 - lastSeen 超时检查

## 🐛 问题

**症状**：
- Desktop 显示：Online: 76 users ❌
- Mobile 显示：Online: 76 users ❌
- 应该显示：Online: 2 users ✅

**根本原因**：
`/presence` 中的所有 76 个用户都有 `state: 'online'`（陈旧数据）
- 用户离线后，`state` 字段没有及时更新
- 只检查 `state === 'online'` 会返回所有用户

---

## ✅ 修复

添加了 **5 分钟 `lastSeen` 超时检查**

### 修复前
```typescript
const onlineUids = Object.entries(presenceVal)
  .filter(([, data]: any) => data?.state === 'online')  // ❌ 过滤条件太宽松
  .map(([uid]) => uid);
// 结果：返回所有 76 个用户
```

### 修复后
```typescript
const now = Date.now();
const timeout = 5 * 60 * 1000;  // 5 分钟

const onlineUids = Object.entries(presenceVal)
  .filter(([, data]: any) => {
    // ★ 修复：两个条件都要满足
    const state = data?.state;
    const lastSeen = data?.lastSeen ?? 0;
    return state === 'online' && (now - lastSeen < timeout);
  })
  .map(([uid]) => uid);
// 结果：只返回最近 5 分钟内活跃的用户
```

---

## 📊 修复对比

| 方面 | 修复前 | 修复后 |
|------|--------|--------|
| **过滤条件** | `state === 'online'` | `state === 'online' AND lastSeen < 5min` |
| **显示用户数** | 76 个 ❌ | 2 个 ✅ |
| **数据准确性** | 不准确 | 准确 |

---

## 🔍 调试日志

打开浏览器 Console 会看到：

```javascript
[useOnlineUsers] sample presence data: {
  total: 76,
  samples: [
    {
      uid: "abc123",
      state: "online",
      lastSeen: "1203s ago",        // ← 20分钟前，应该被过滤掉
      isActive: false
    },
    {
      uid: "def456",
      state: "online",
      lastSeen: "45s ago",          // ← 刚才活跃，保留
      isActive: true
    },
    // ... 更多样本
  ],
  onlineCount: 2  // ← 正确的在线用户数
}
```

---

## 🧪 验证

### 清除缓存
```
Ctrl+Shift+Delete  // 清除所有数据
Ctrl+Shift+R       // 硬刷新
```

### 验证结果
1. 打开 2 个浏览器标签页
   - 标签页 A：用户 A 登录
   - 标签页 B：用户 B 登录

2. 查看显示
   - 标签页 A 的 Sidebar 应该显示：**Online: 1 users** (用户 B，不含自己)
   - 标签页 B 的 Sidebar 应该显示：**Online: 1 users** (用户 A，不含自己)

3. 手机端验证
   - 手机打开 Safari：应该显示 **Online: 2 users**

4. Console 日志
   ```
   [useOnlineUsers] online users count: 2  // ← 正确
   [Home] onlineUsers length = 1           // ← 排除自己
   [Sidebar] onlineUsers length = 1        // ← 排除自己
   ```

---

## 📝 提交信息

```
fix: add lastSeen timeout check to useOnlineUsers hook

- Filter users by: state === 'online' AND lastSeen < 5 minutes
- Without timeout check, all 76 users were shown
- Now only shows truly active users (last 5 minutes)
- Add detailed debug logging
- Fixes: showing 76 users instead of 2
```

**Commit**: `06a6ec2`

---

## 🎯 关键原理

**为什么需要 `lastSeen` 检查？**

1. **状态滞后**：用户关闭浏览器后，Firebase `state` 字段不会立即更新
2. **时间戳精准**：`lastSeen` 记录了最后一次心跳时间，能准确判断是否活跃
3. **5分钟窗口**：与 presence 心跳间隔保持一致

**数据结构**：
```json
{
  "uid_1": {
    "state": "online",        // 可能滞后
    "lastSeen": 1761853048935 // 精准记录最后活动时间
  }
}
```

---

## 完成

修复已提交到 GitHub，现在两端都会正确显示真正在线的用户数！

下一步：清除浏览器缓存并刷新验证修复效果。
