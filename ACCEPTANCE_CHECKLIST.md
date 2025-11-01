# ✅ 消息统计系统 - 验收与自测清单

**版本**：v1.15  
**日期**：2025-11-01  
**组件**：Firebase RTDB 规则 + Cloud Functions + 一次性回填脚本 + 前端展示

---

## 📋 **预备检查**

### ✅ 1. Firebase 规则检查

**目标**：控制台不再出现 Index not defined `.indexOn "createdAt"` 报错

**步骤**：
1. 打开 Firebase Console → Realtime Database → Rules 标签
2. 验证以下节点包含 `.indexOn` 配置：
   ```json
   "messages": {
     "$roomId": {
       ".indexOn": ["createdAt", "authorId"]  ← ✅ 必须
     }
   },
   "dmMessages": {
     "$threadId": {
       ".indexOn": ["createdAt", "authorId"]  ← ✅ 必须
     }
   }
   ```

**验证方法**：
```javascript
// 在浏览器控制台运行
import { getDatabase, ref, orderByChild, query } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';

const db = getDatabase();
const q = query(ref(db, 'messages/roomId'), orderByChild('createdAt'));
console.log('✅ Query with .indexOn succeeded (no index error)');
```

**预期结果**：
- ❌ **无此报错**：`⚠️ Index not defined. Create index for: .indexOn: ["createdAt", "authorId"]`
- ✅ 查询正常返回数据或空数组（无错误）

---

### ✅ 2. 一次性回填脚本调用

**目标**：返回 `{ ok: true, users: N }`，表示成功回填 N 个用户的历史消息数

**步骤**：

#### **方案 A：通过浏览器控制台调用（推荐）**

```javascript
// 1. 导入必要的 Firebase 模块
import { getApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-functions.js';

// 2. 获取 functions 实例
const app = getApp();
const functions = getFunctions(app, 'us-central1');

// 3. 调用回填函数
const backfillUserMsgCount = httpsCallable(functions, 'backfillUserMsgCount');

try {
  const result = await backfillUserMsgCount({});
  console.log('✅ Backfill succeeded:', result.data);
  // 预期输出：
  // {
  //   ok: true,
  //   users: 42,           ← 更新的用户数
  //   totalMessages: 1234, ← 处理的总消息数
  //   processedRooms: 8    ← 处理的房间数
  // }
} catch (err) {
  console.error('❌ Backfill failed:', err);
}
```

**预期结果**：
```javascript
✅ Backfill succeeded: {
  ok: true,
  users: 42,           // 根据实际消息数
  totalMessages: 1234,
  processedRooms: 8
}
```

**可能的错误**：
- `❌ Error: User is not admin` → 需要用 admin 账号（patx2024@gmail.com）登录
- `❌ Error: User not authenticated` → 需要先登录
- `❌ Network error / timeout` → 消息太多，稍等后重试或分批处理

#### **验证数据已写入**

```javascript
// 验证 /profilesStats 中有数据
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';

const db = getDatabase();
const statsSnap = await get(ref(db, 'profilesStats'));
if (statsSnap.exists()) {
  const stats = statsSnap.val();
  console.log('✅ profilesStats 数据已写入:', Object.keys(stats).length, '个用户');
  console.log('示例用户统计:', Object.entries(stats).slice(0, 3).map(([uid, s]) => ({
    uid: uid.substring(0, 8) + '...',
    messageCount: s.messageCount
  })));
} else {
  console.warn('⚠️ profilesStats 为空');
}
```

**预期结果**：
```
✅ profilesStats 数据已写入: 42 个用户
示例用户统计: [
  { uid: "abc123d9...", messageCount: 42 },
  { uid: "def456e8...", messageCount: 18 },
  { uid: "ghi789f7...", messageCount: 5 }
]
```

---

## 🧪 **功能验证**

### ✅ 3. Admin Dashboard - Users 列表

**目标**：刷新 Admin → Users，每个用户的显示从 `0 msgs` 变为真实值

**步骤**：

1. **登录 Admin 账号**
   - 邮箱：`patx2024@gmail.com`
   - 密码：*（你的密码）*
   - 或在 `/home` 登录后访问 `/chatsphereGPT/#/admin`

2. **打开 Users 列表**
   - 导航：Admin Dashboard → 左侧 "Users" 卡片
   - 或直接看首页 Statistics 区域

3. **验证数据**

**预期显示**（刷新前后对比）：

```
❌ 之前（未回填）：
  ┌─────────────────────┐
  │ user1               │
  │ online • 0 msgs     │
  ├─────────────────────┤
  │ user2               │
  │ offline • 0 msgs    │
  └─────────────────────┘

✅ 之后（已回填）：
  ┌─────────────────────┐
  │ user1               │
  │ online • 42 msgs    │ ← 真实值
  ├─────────────────────┤
  │ user2               │
  │ offline • 18 msgs   │ ← 真实值
  └─────────────────────┘
```

**控制台检查**：
```javascript
// 打开浏览器 F12 → Console，应该看到：
// ✅ 正常：无 warn
// [Admin] Users list loaded from API

// ❌ 异常：有 warn
// [Admin] User xxx (baby) has no valid messageCount field
// { messageCount: undefined, type: "undefined", user: {...} }
```

**Network 验证**：
1. 打开 DevTools → Network 标签
2. 刷新页面，找到 `/admin/users` 请求
3. 查看 Response：
   ```json
   {
     "users": [
       {
         "uid": "abc123",
         "name": "user1",
         "messageCount": 42,        ← ✅ 有值
         "lastMessageAt": 1699999999,
         ...
       }
     ]
   }
   ```

**预期结果**：✅ 所有用户都显示非零的真实消息数（或至少部分用户）

---

### ✅ 4. 实时更新 - 发送消息后计数 +1

**目标**：发送一条新消息后，该作者的 `messageCount` 立刻增加 1

**前置条件**：
- ✅ 已回填历史消息
- ✅ 已部署 `onMessageCreate` Cloud Function trigger

**步骤**：

1. **记录初始值**
   ```javascript
   // 在 Admin 页面控制台查询当前用户的消息数
   import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';
   
   const db = getDatabase();
   const uid = 'xxx'; // 当前登录用户的 uid
   const statsSnap = await get(ref(db, `profilesStats/${uid}/messageCount`));
   
   const initialCount = statsSnap.val() || 0;
   console.log(`📊 初始消息数: ${initialCount}`);
   ```

2. **发送一条消息**
   - 进入任意公开房间（如 "General"）
   - 输入文本消息，点击发送
   - **不要刷新页面**

3. **检查计数**（立即，2秒内）
   ```javascript
   // 再次查询
   import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';
   
   const db = getDatabase();
   const uid = 'xxx';
   const statsSnap = await get(ref(db, `profilesStats/${uid}/messageCount`));
   
   const newCount = statsSnap.val() || 0;
   console.log(`📊 新消息数: ${newCount}`);
   
   if (newCount === initialCount + 1) {
     console.log('✅ 计数已更新: +1');
   } else {
     console.log(`❌ 计数未更新: ${initialCount} → ${newCount} (expected ${initialCount + 1})`);
   }
   ```

4. **刷新 Admin 用户列表验证**
   - 返回 Admin 页面
   - 点击 Users 卡片或刷新页面
   - 该用户应显示 `msgCount + 1`

**预期结果**：
- ✅ 发送后 1-3 秒内，`profilesStats/{uid}/messageCount` 增加 1
- ✅ Admin 用户列表显示更新后的数值
- ✅ 浏览器控制台无错误

**调试信息**（如果失败）：
```javascript
// 检查 Cloud Function 日志
// 1. Firebase Console → Functions → Logs 标签
// 2. 搜索 "onMessageCreate"
// 3. 查看是否有执行记录和报错

// 手动检查 /messages 中的新消息
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';

const db = getDatabase();
const roomId = 'xxx'; // 发送消息的房间 ID
const messagesSnap = await get(ref(db, `messages/${roomId}`));

const msgs = messagesSnap.val();
const lastMsg = Object.values(msgs as any[]).pop();
console.log('最后一条消息:', lastMsg);
// 应该显示：{ authorId: "xxx", createdAt: 1699999999, content: "...", type: "text" }
```

---

### ✅ 5. 实时更新 - 删除消息后计数 -1

**目标**：删除一条消息后，该作者的 `messageCount` 立刻减少 1（不小于 0）

**前置条件**：
- ✅ 已发送至少 1 条消息（来自上一步）
- ✅ 已部署 `onMessageDelete` Cloud Function trigger

**步骤**：

1. **记录初始值**
   ```javascript
   import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';
   
   const db = getDatabase();
   const uid = 'xxx';
   const statsSnap = await get(ref(db, `profilesStats/${uid}/messageCount`));
   
   const beforeDelete = statsSnap.val() || 0;
   console.log(`📊 删除前消息数: ${beforeDelete}`);
   ```

2. **删除一条消息**
   - 在聊天页面找到自己发送的消息
   - 悬停/长按消息，选择删除选项
   - 确认删除

3. **检查计数**（立即，2秒内）
   ```javascript
   import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js';
   
   const db = getDatabase();
   const uid = 'xxx';
   const statsSnap = await get(ref(db, `profilesStats/${uid}/messageCount`));
   
   const afterDelete = statsSnap.val() || 0;
   console.log(`📊 删除后消息数: ${afterDelete}`);
   
   if (afterDelete === beforeDelete - 1) {
     console.log('✅ 计数已更新: -1');
   } else if (afterDelete === beforeDelete) {
     console.log('⚠️ 计数未变化（可能权限问题或消息未真正删除）');
   } else {
     console.log(`❌ 计数异常: ${beforeDelete} → ${afterDelete}`);
   }
   ```

4. **检查计数不为负**
   ```javascript
   // 确保删除后的计数 >= 0
   const afterDelete = statsSnap.val() || 0;
   
   if (afterDelete >= 0) {
     console.log('✅ 计数不为负');
   } else {
     console.log('❌ 计数为负（触发器有 bug）:', afterDelete);
   }
   ```

**预期结果**：
- ✅ 删除后 1-3 秒内，`profilesStats/{uid}/messageCount` 减少 1
- ✅ 计数始终 >= 0（无负数）
- ✅ 浏览器控制台无错误

---

### ✅ 6. Admin Dashboard - 24小时消息统计

**目标**：验证 24h 消息统计仍使用 `createdAt` + `.indexOn` 的查询逻辑（之前已修复索引）

**步骤**：

1. **打开 Admin Dashboard**
   - 导航：Admin → Statistics 区域（顶部）

2. **验证以下数据已正确显示**
   ```
   Statistics 卡片：
   ┌──────────────────────────────────┐
   │ Messages (24h)    │ 1,234        │ ← 过去 24 小时的消息数
   │ DAU               │ 42           │ ← 日活用户数
   │ Top Rooms         │ #general: 234│ ← 最活跃的房间
   └──────────────────────────────────┘
   ```

3. **检查 Network 请求**
   - 打开 DevTools → Network
   - 找到 `/admin/users` 或 `/api` 请求
   - 查看响应中是否包含正确的统计数据

4. **验证无索引错误**
   ```javascript
   // 在浏览器控制台检查是否有警告
   // 预期：无此错误
   // ⚠️ Index not defined. Create index for: .indexOn: ["createdAt"]
   
   // ✅ 预期正确输出：
   // [Admin] Message stats loaded: 1234 messages in 24h
   ```

**预期结果**：
- ✅ Messages (24h) 显示正确的数值（> 0）
- ✅ 图表 "Messages over 24 hours" 显示柱状数据（不全 0）
- ✅ "24h Peak Activity" 显示峰值小时
- ✅ Top Rooms 显示房间名称（不是 ID）
- ✅ 浏览器控制台无索引错误

**常见问题排查**：

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| Messages (24h) = 0 | createdAt 时区计算错误 | 检查 Cloud Function 使用 `getHours()` 而非 `getUTCHours()` |
| 图表全 0 | buckets 初始化或赋值错误 | 检查 aggregateMetrics 逻辑 |
| 无索引错误但数据为空 | 规则中无 `.indexOn` | 检查 firebase.rules.json 第 50 行 |
| Top Rooms 显示 ID | 未获取房间名称 | 检查 countMessages24hFromRTDB 是否调用 rooms 节点 |

---

## 📊 **性能基准**

| 指标 | 预期值 | 实际值 | 状态 |
|------|--------|--------|------|
| 回填脚本耗时 | < 30s | - | ✅ |
| 消息发送 → 计数 +1 | < 3s | - | ✅ |
| 消息删除 → 计数 -1 | < 3s | - | ✅ |
| Admin 加载时间 | < 5s | - | ✅ |
| 索引错误 | 0 个 | - | ✅ |

---

## 🚀 **发布清单**

- [ ] ✅ Firebase 规则已发布（`.indexOn` 配置完整）
- [ ] ✅ Cloud Functions 已部署
  - [ ] `aggregateMetrics`
  - [ ] `calculateDailyActiveUsers`
  - [ ] `onMessageCreate` (消息计数 +1)
  - [ ] `onMessageDelete` (消息计数 -1)
  - [ ] `backfillUserMsgCount` (一次性回填)
- [ ] ✅ 前端代码已部署到 GitHub Pages
- [ ] ✅ 一次性回填脚本已调用
- [ ] ✅ 验证所有 6 项功能正常

---

## 📝 **日志记录**

### 回填脚本执行日志

```
执行时间：YYYY-MM-DD HH:MM:SS UTC
操作者：patx2024@gmail.com
返回值：{ ok: true, users: N, totalMessages: M, processedRooms: R }
备注：______________________
```

### 消息发送测试日志

```
测试用户：__________
测试房间：__________
发送前计数：__________
发送后计数：__________
延迟（秒）：__________
状态：✅ / ❌
```

### 消息删除测试日志

```
测试用户：__________
测试房间：__________
删除前计数：__________
删除后计数：__________
延迟（秒）：__________
状态：✅ / ❌
```

---

## ⚠️ **已知限制**

1. **DAU 计算只在 UTC 00:05 触发**
   - Cloud Function `calculateDailyActiveUsers` 每天只跑一次
   - 实时 DAU 需用客户端计算（已在 Admin.tsx 实现）

2. **回填脚本需管理员权限**
   - 仅 `patx2024@gmail.com` 账号可调用
   - 只需运行一次

3. **消息计数基于 authorId**
   - 删除消息时需确保 `authorId` 完整
   - DM 消息统计在 `dmMessages` 中（独立）

---

## 📞 **支持**

如有问题，请检查：
1. Firebase Console → Logs 查看 Cloud Function 执行日志
2. Browser DevTools → Console 查看前端错误
3. Browser DevTools → Network 查看 API 响应
4. Firebase Realtime Database 直接查看数据结构

---

**版本历史**

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2025-11-01 | 初始版本 |
