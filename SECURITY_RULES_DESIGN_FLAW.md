# Firebase 安全规则设计缺陷 - 关键问题

**问题**: 所有 DM、Block、Ban、Kick、邀请等功能都失败  
**根本原因**: 新安全规则与现有代码流程冲突  
**严重程度**: 🔴 **严重 - 影响所有社交功能**  
**分析时间**: 2025-11-10

---

## 🔍 问题 1: DM 消息写入顺序问题

### 错误现象

```
FIREBASE WARNING: set at /dmMessages/... failed: permission_denied
```

### 新规则要求

```json
"dmMessages": {
  "$threadId": {
    ".write": "auth != null && 
              root.child('dmThreads').child(auth.uid).child($threadId).exists() && 
              ..."
    // ↑ 必须先在 dmThreads 中存在
  }
}
```

### 代码执行顺序（错误）

```typescript
// src/components/Composer.tsx - Line 152-173
await push(dbRef(db, `/dmMessages/${target.dmId}`), payload);  // Step 1: 写 dmMessages
// ❌ 此时 dmThreads 还不存在 → permission_denied

await set(dbRef(db, `/dmThreads/${me}/${target.dmId}`), { ... });  // Step 2: 才创建 dmThreads
// ← 太晚了！
```

### 正确的顺序应该是

```
Step 1: 检查 dmThreads 是否存在，不存在则先创建
Step 2: 才能写 dmMessages
```

---

## 🔍 问题 2: Block 操作权限

### 新规则

```json
"blocks": {
  ".write": false,  // ← 顶层禁写！
  "$uid": {
    ".write": "auth != null && auth.uid === $uid"
  }
}
```

### 代码

```typescript
// src/lib/social.ts - Line 8
await update(ref(db), { [`blocks/${me}/${targetUid}`]: true });
//     ↑ 这是"跨路径 update"操作
```

### 问题

当执行 `update(ref(db), {...})` 时：
1. 检查 `blocks/.write` → `.write: false` → ❌ 拒绝

即使子路径有 `.write` 权限，顶层被禁止也无法操作。

---

## 🔍 问题 3: Ban/Kick 操作

### 代码

```typescript
// src/components/MembersSheet.tsx - Line 60-62
await update(ref(db), {
  [`rooms/${roomId}/bans/${uid}`]: true,
});
```

### 问题

同样是跨路径 update，但：
- `rooms/$roomId/bans/$uid` 规则允许写入
- 但根目录 `.write: false` 会拦截

---

## 🔍 问题 4: 邀请/其他操作

类似问题影响所有跨路径或复杂的数据库操作。

---

## 💡 解决方案对比

### 方案 A: 修改规则（推荐 - 保持安全）

#### A1: 允许 dmThreads 的"管理员"级操作

```json
"dmThreads": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid",
    "$threadId": {  // ← 添加此级别
      ".write": "auth != null && auth.uid === $uid"
    }
  }
}
```

**目的**: 让 `set(/dmThreads/{uid}/{threadId})` 的写操作先创建线程

#### A2: 调整 dmMessages 规则

旧:
```json
".write": "auth != null && 
          root.child('dmThreads').child(auth.uid).child($threadId).exists() && 
          ..."
```

新:
```json
".write": "auth != null && 
          newData.child('authorId').val() === auth.uid && 
          newData.child('content').isString()"
// 移除 dmThreads 依赖检查，改为在代码中确保先创建 dmThreads
```

#### A3: 使用 Cloud Function 统一处理

创建一个 Cloud Function `sendDM`：
1. 接收 {dmId, content, recipient}
2. 先创建 dmThreads（函数权限）
3. 再写入 dmMessages（函数权限）
4. 客户端调用此函数而非直接写数据库

**好处**:
- ✅ 数据完整性有保障
- ✅ 服务端验证
- ✅ 规则可以保持严格

---

### 方案 B: 修改代码流程（次选）

#### B1: 改变执行顺序

```typescript
const dmId = target.dmId;
const [a, b] = dmId.split('__');
const me = uid;
const peer = me === a ? b : a;

// Step 1: 先确保 dmThreads 存在（两方都创建）
await set(dbRef(db, `/dmThreads/${me}/${dmId}`), {
  threadId: dmId,
  peerId: peer,
  // ... 
});

// Step 2: 再写消息
await push(dbRef(db, `/dmMessages/${dmId}`), payload);
```

**问题**:
- 如果消息失败但 thread 已创建，不一致
- 无法保证原子性

#### B2: 使用 transaction

```typescript
const dmId = target.dmId;
const result = await runTransaction(ref(db, `/dmThreads/${me}/${dmId}`), (current) => {
  // 返回新的 thread 数据
  return {
    threadId: dmId,
    peerId: peer,
    // ...
  };
});

if (result.committed) {
  // 只有成功创建 thread 后才写消息
  await push(dbRef(db, `/dmMessages/${dmId}`), payload);
}
```

**好处**:
- ✅ 保证原子性
- ✅ 不用改规则

---

### 方案 C: 回滚到之前的规则（不推荐）

保留所有安全加强除了 dmMessages 的 dmThreads 依赖。

**缺点**:
- ❌ 失去了一层隐私保护
- ❌ 又回到"任何登录用户都能读 DM"

---

## 🛡️ 安全性评估

| 方案 | 安全性 | 易实现 | 推荐 |
|------|--------|--------|------|
| A1+A2 (改规则) | ⭐⭐⭐ (中) | ⭐ (复杂) | ✓ 最佳 |
| A3 (Cloud Function) | ⭐⭐⭐⭐⭐ (高) | ⭐⭐ (中等) | ✓ 企业级 |
| B1 (改顺序) | ⭐ (低) | ⭐⭐⭐ (简单) | ✗ |
| B2 (transaction) | ⭐⭐ (中低) | ⭐⭐ (中等) | ⚠️ |
| C (回滚) | ⭐ (低) | ⭐⭐⭐⭐ (极简) | ❌ |

---

## 📋 影响范围

### 🔴 完全失效

- ❌ DM 消息发送（本案例所见）
- ❌ Block 用户（跨路径 update）
- ❌ Ban 用户（跨路径 update）
- ❌ Kick 用户（跨路径 update）
- ❌ 邀请用户（跨路径 update）

### 🟡 部分受限

- ⚠️ 个人资料编辑（isAdmin 冻结）
- ⚠️ 房间管理（complex write rules）

### 🟢 正常

- ✅ 登录/注册（已修复）
- ✅ 读取消息（.read 规则正常）
- ✅ 创建房间（单路径写）

---

## 🎯 立即修复方案（推荐）

### 快速方案：允许 dmThreads 跨路径操作

修改规则，允许在 dmThreads 中创建新线程：

```json
"dmThreads": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid"
    // 保持不变，已经允许
  }
}

"dmMessages": {
  "$threadId": {
    ".read": "auth != null && root.child('dmThreads').child(auth.uid).child($threadId).exists()",
    // 简化 write 规则：只检查权限，不检查 dmThreads 存在
    // 改由代码保证先创建 dmThreads
    ".write": "auth != null && 
              newData.exists() && 
              newData.hasChildren(['authorId', 'content', 'createdAt']) && 
              newData.child('authorId').val() === auth.uid && 
              newData.child('content').isString()"
              // ← 移除 dmThreads 依赖，改为代码确保
  }
}
```

### 同时调整代码执行顺序

```typescript
// src/components/Composer.tsx
// 发送 DM 前，先确保 dmThreads 存在
const ensureDmThread = async (dmId: string, me: string, peer: string) => {
  try {
    await set(dbRef(db, `/dmThreads/${me}/${dmId}`), {
      threadId: dmId,
      peerId: peer,
      lastMsg: '',
      lastSender: me,
      lastTs: serverTimestamp(),
      unread: 0
    });
  } catch (e) {
    console.warn('Failed to ensure dmThread:', e);
    // 继续，因为可能已存在
  }
};

// 然后才发送消息
await ensureDmThread(target.dmId, uid, peerUid);
await push(dbRef(db, `/dmMessages/${target.dmId}`), payload);
```

---

## ⚠️ 其他需要修复的规则问题

### blocks 顶层 .write: false 的问题

当代码执行：
```typescript
await update(ref(db), { [`blocks/${me}/${targetUid}`]: true });
```

检查流程：
1. 检查 `blocks/.write` → false → ❌

**修复**:
```json
"blocks": {
  ".write": "auth != null",  // ← 改为允许跨路径操作
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid",
    "$peerUid": {
      ".read": "auth != null && auth.uid === $uid",
      ".write": "auth != null && auth.uid === $uid"
    }
  }
}
```

---

## 总结

**根本问题**: 新规则过于严格，与现有代码流程不兼容

**快速修复** (保持大部分安全加强):
1. 调整 dmMessages 规则，移除 dmThreads 依赖检查
2. 改变代码执行顺序，先创建 dmThreads
3. 修改 blocks 规则允许顶层写
4. 测试所有社交功能

**长期解决** (企业级):
使用 Cloud Function 处理所有复杂操作，客户端无法直接写数据库

---

**这是设计缺陷，不是代码bug。需要规则和代码双向调整。**

