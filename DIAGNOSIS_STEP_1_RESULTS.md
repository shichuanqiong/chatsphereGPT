# 🔍 Admin Dashboard 消息计数诊断报告

## 按顺序排查结果

### ✅ 第1步：Network 检查 /admin/users 响应

**测试命令：**
```javascript
fetch('https://us-central1-chatspheregpt.cloudfunctions.net/api/admin/users', {
  headers: { 'x-admin-key': 'ChatSphere2025Secure!@#$%' }
})
.then(r => r.json())
.then(data => console.log(data))
```

**结果：** ❌
```json
{ "error": "Unauthorized" }
```

**原因分析：**
| 项目 | 前端值 | 后端值 | 匹配状态 |
|------|------|------|--------|
| Admin Key（前端） | `ChatSphere2025Secure!@#$%` (长度 29) | - | - |
| Admin Key（后端 fallback） | - | `ChatSphere2025AdminSecure` (长度 26) | ❌ 不匹配 |
| 环境变量（GitHub Actions） | 未传递 | - | ❌ 缺失 |

**根本原因：**
1. 后端 Cloud Function 从 `process.env.ADMIN_KEY` 读取
2. 如果无环境变量，使用 fallback：`'ChatSphere2025AdminSecure'`（第 53 行）
3. GitHub Actions 部署流程**没有**在 `env` 中传递 `VITE_ADMIN_KEY`
4. 前端用的是另一个 Key：`'ChatSphere2025Secure!@#$%'`
5. 两个 Key 不一致，导致 401 Unauthorized

---

### ✅ 第2步：后端接口代码检查

**文件：** `functions/src/index.ts` 第 122-165 行

**验证结果：** ✅ 代码正确

```typescript
// Line 129-130：获取 profilesStats 数据
const statsSnap = await rtdb.ref('/profilesStats').get();
const statsData = statsSnap.val() || {};

// Line 145-152：从 profilesStats 读取并返回
const stats = statsData[uid] || {};
return {
  uid,
  name: data.nickname || data.displayName || data.name || '未知用户',
  email: data.email || '',
  status: isOnline ? 'online' : 'offline',
  messageCount: stats.messageCount ?? 0,  // ← 从 profilesStats 读取
  ...
};
```

**确认：** ✅ 接口确实从 `profilesStats/{uid}/messageCount` 取值

---

### ❌ 第3步：RTDB /profilesStats 检查（受阻）

**原因：** 由于第 1 步的认证失败，无法调用 API 获取数据。
需要先修复 Admin Key 问题。

---

### ❌ 第4步：Cloud Functions 日志检查（受阻）

**原因：** 同上。需要先修复认证问题。

---

### ❌ 第5步：Firebase Rules 检查（受阻）

**原因：** 同上。

---

## 🔧 解决方案

### 问题 1：Admin Key 不匹配

**现状：**
- 前端使用：`ChatSphere2025Secure!@#$%`
- 后端使用：`ChatSphere2025AdminSecure`（fallback）

**解决方式 A：统一使用同一个 Key（推荐快速方案）**

选择其中一个 Key，两边都用它。比如都用前端的：

1. **修改后端 fallback Key**：
   ```typescript
   // functions/src/index.ts 第 53 行
   - const fallbackKey = 'ChatSphere2025AdminSecure';
   + const fallbackKey = 'ChatSphere2025Secure!@#$%';
   ```

2. **部署 Cloud Functions：**
   ```bash
   firebase deploy --only functions
   ```

3. **测试：**
   ```javascript
   fetch('https://us-central1-chatspheregpt.cloudfunctions.net/api/admin/users', {
     headers: { 'x-admin-key': 'ChatSphere2025Secure!@#$%' }
   })
   .then(r => r.json())
   .then(data => console.log(data))
   ```

**解决方式 B：正确设置环境变量（更安全的长期方案）**

1. **在 GitHub Actions 中设置 Secret：**
   - 去 GitHub Repo → Settings → Secrets and variables → Actions
   - 新增：`FUNCTIONS_ADMIN_KEY` = `ChatSphere2025Secure!@#$%`

2. **在部署工作流中使用：**
   需要在 `firebase deploy` 前设置环境变量。

3. **在 Cloud Function 中读取：**
   已经在第 42 行实现了：`const envKey = process.env.ADMIN_KEY;`

---

## 📊 当前状态总结

| 环节 | 状态 | 说明 |
|-----|------|------|
| Network 请求 | ❌ | 401 Unauthorized（Key 不匹配） |
| 后端代码 | ✅ | `/admin/users` 从 profilesStats 读取（正确） |
| 规则和 profilesStats 数据 | ⏳ | 需要先修复认证后才能检查 |

---

## ⏭️ 下一步行动

1. **立即**：修改后端 fallback Key 或设置环境变量
2. **部署**：`firebase deploy --only functions`
3. **测试**：重新调用 `/admin/users` API
4. **继续**：如果成功返回数据，继续检查 `/profilesStats` 中是否有 messageCount 数据

---

## 📝 后续检查（等 Key 修复后）

一旦认证通过，按以下顺序继续：

1. ✅ 检查 `/admin/users` 返回的 `messageCount`（应该 > 0 或至少有这个字段）
2. 检查 `/profilesStats` node 是否有数据
3. 检查 Cloud Functions `onMessageCreate` 日志是否有执行
4. 检查 Firebase Rules 中 `.indexOn` 是否生效

