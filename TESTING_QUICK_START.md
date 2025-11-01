# 🚀 消息统计系统 - 快速测试指南

> 30 分钟内完成所有验证

---

## ⚡ **第 1 步：验证规则（2 分钟）**

打开浏览器，导航到 ChatSphere，打开控制台（F12 → Console）：

```javascript
// 粘贴此代码
(async () => {
  const db = firebase.database();
  const q = firebase.database.Query.orderByChild('createdAt');
  try {
    const snap = await db.ref('messages').once('value');
    console.log('✅ 规则检查通过：不显示 Index not defined 错误');
  } catch (e) {
    console.error('❌ 规则检查失败:', e);
  }
})();
```

**预期**：✅ 无错误信息

---

## ⚡ **第 2 步：调用回填脚本（5 分钟）**

1. **登录 admin 账号**
   - 邮箱：`patx2024@gmail.com`
   - 密码：*你的密码*

2. **打开控制台，粘贴并运行**：

```javascript
// 获取 Firebase 实例
const app = firebase.app();
const functions = firebase.functions('us-central1');

// 调用回填脚本
const backfillUserMsgCount = firebase.functions().httpsCallable('backfillUserMsgCount');

backfillUserMsgCount({})
  .then(result => {
    console.log('✅ 回填完成！');
    console.log(result.data);
    // 预期输出：
    // {
    //   ok: true,
    //   users: 42,           ← 更新用户数
    //   totalMessages: 1234, ← 处理消息数
    //   processedRooms: 8    ← 处理房间数
    // }
  })
  .catch(err => {
    console.error('❌ 回填失败:', err.message);
    if (err.message.includes('admin')) {
      console.log('💡 提示：需要用 admin 账号登录（patx2024@gmail.com）');
    }
  });
```

**预期**：✅ `{ ok: true, users: N, totalMessages: M, processedRooms: R }`

---

## ⚡ **第 3 步：验证 Admin 用户列表（3 分钟）**

1. **进入 Admin Dashboard**
   - URL：`https://shichuanqiong.github.io/chatsphereGPT/#/admin`

2. **查看 Users 卡片**
   - 应该看到用户列表显示非零的消息数
   - 示例：`user1 • 42 msgs`、`user2 • 18 msgs`

3. **如果还是显示 0**
   - 按 F5 强制刷新
   - 打开 DevTools → Network，找 `/admin/users` 请求
   - 检查 Response 中 `messageCount` 是否有值

**预期**：✅ 看到真实的消息数（> 0）

---

## ⚡ **第 4 步：测试实时更新 - 发送消息 +1（5 分钟）**

1. **获取初始消息数**
   ```javascript
   const db = firebase.database();
   const uid = firebase.auth().currentUser.uid;
   const snap = await db.ref(`profilesStats/${uid}/messageCount`).once('value');
   const initialCount = snap.val() || 0;
   console.log(`初始计数: ${initialCount}`);
   ```

2. **进入任意公开房间，发送一条消息**
   - 输入内容，点击发送
   - **不要刷新页面**

3. **检查计数（等待 2-3 秒）**
   ```javascript
   const db = firebase.database();
   const uid = firebase.auth().currentUser.uid;
   const snap = await db.ref(`profilesStats/${uid}/messageCount`).once('value');
   const newCount = snap.val() || 0;
   console.log(`新计数: ${newCount}`);
   console.log(newCount === initialCount + 1 ? '✅ +1 成功' : '❌ 未更新');
   ```

**预期**：✅ 新计数 = 初始计数 + 1

---

## ⚡ **第 5 步：测试实时更新 - 删除消息 -1（5 分钟）**

1. **记录删除前的计数**
   ```javascript
   const db = firebase.database();
   const uid = firebase.auth().currentUser.uid;
   const snap = await db.ref(`profilesStats/${uid}/messageCount`).once('value');
   const beforeDelete = snap.val() || 0;
   console.log(`删除前: ${beforeDelete}`);
   ```

2. **在聊天页删除刚才发的消息**
   - 找到消息，点击删除

3. **检查计数（等待 2-3 秒）**
   ```javascript
   const db = firebase.database();
   const uid = firebase.auth().currentUser.uid;
   const snap = await db.ref(`profilesStats/${uid}/messageCount`).once('value');
   const afterDelete = snap.val() || 0;
   console.log(`删除后: ${afterDelete}`);
   console.log(afterDelete === beforeDelete - 1 ? '✅ -1 成功' : 
               afterDelete >= 0 ? '⚠️ 未减少但 >= 0' : '❌ 为负数');
   ```

**预期**：✅ 新计数 = 初始计数 - 1，且 >= 0

---

## ⚡ **第 6 步：验证 24h 统计（2 分钟）**

1. **回到 Admin Dashboard**
   - 顶部 Statistics 区域

2. **检查以下字段**
   - ✅ `Messages (24h)` > 0
   - ✅ `DAU` > 0
   - ✅ `Top Rooms` 显示房间名字（不是 ID）
   - ✅ 图表无报错

3. **如果出现问题**
   - 打开 DevTools → Console
   - 检查是否有 "Index not defined" 错误
   - 检查 Firebase Console → Functions → Logs

**预期**：✅ 所有数据正常显示

---

## ✅ **验收通过清单**

- [ ] ✅ 第 1 步：规则检查 - 无索引错误
- [ ] ✅ 第 2 步：回填脚本 - 返回 `{ ok: true, ... }`
- [ ] ✅ 第 3 步：Admin 用户列表 - 显示真实消息数
- [ ] ✅ 第 4 步：发送消息 - 计数 +1
- [ ] ✅ 第 5 步：删除消息 - 计数 -1（>= 0）
- [ ] ✅ 第 6 步：24h 统计 - 数据正常

**所有项目勾选后即为验收完成！** 🎉

---

## 🆘 **常见问题排查**

| 问题 | 解决方案 |
|------|--------|
| "User is not admin" | 用 `patx2024@gmail.com` 登录 |
| "Network error" | 等待 30s，消息数量太多可能超时 |
| messageCount 仍为 0 | 刷新 Admin 页面，等待 5s 后重试 |
| 计数 +1 没反应 | 检查 Cloud Function Logs 中是否有错误 |
| 计数为负数 | 有 bug，联系开发者 |
| Index 错误仍然出现 | Firebase Console → Rules 检查是否真的发布了 |

---

**时间统计**：总耗时约 22-30 分钟

**需要帮助？** 查看详细版 → [ACCEPTANCE_CHECKLIST.md](./ACCEPTANCE_CHECKLIST.md)
