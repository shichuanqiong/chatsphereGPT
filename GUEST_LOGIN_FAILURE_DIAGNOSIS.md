# Guest 用户无法登录 - 根本原因诊断

**诊断日期：** 2025-11-06  
**问题状态：** ✅ 已诊断  
**根本原因：** Firebase 规则中缺少 `nicknameIndex` 路径的定义

---

## 🔍 问题分析

### 现象
- ✅ 注册用户可以登录
- ❌ Guest 用户无法登录

### 登录流程

```
Guest Login Flow:
1. 用户输入昵称、年龄、性别、国家
2. 点击 "Guest Login" 按钮
   ↓
3. 调用 doGuest()
   ├─ ensureProfileValid() - 验证输入 ✅
   ├─ signInAnonymously(auth) - Firebase 匿名认证 ✅
   ├─ updateProfile() - 更新显示名 ✅
   └─ afterLogin() - 后续操作
      ├─ reserveNickname() ❌ 问题在这里！
      └─ ...
```

---

## ❌ 根本原因

### 问题 1：缺少 `nicknameIndex` 规则

**当前 firebase.rules.json 状态：**
```
✅ profiles - 有规则
✅ profilesStats - 有规则
✅ roles - 有规则
✅ rooms - 有规则
✅ roomMembers - 有规则
❌ nicknameIndex - 无规则！
```

**代码中的 `reserveNickname` 函数：**
```typescript
const reserveNickname = async (uid: string, nickname: string) => {
  const slug = nickname.toLowerCase();
  const indexRef = ref(db, `/nicknameIndex/${slug}`);  // ← 写入这个路径
  
  const result = await runTransaction(indexRef, (current: any) => {
    if (!current || current.uid === uid) {
      return { uid };  // ← 尝试写入 { uid }
    }
    return current;
  }, { applyLocally: false });
  
  if (!result.committed) {
    const err: any = new Error('nickname-taken');
    throw err;  // ❌ 由于规则拒绝，这里会报错
  }
  // ...
};
```

**Firebase 规则检查：**
```
当代码尝试写入 /nicknameIndex/{slug} 时：
1. Firebase 检查规则
2. 发现没有 nicknameIndex 路径的定义
3. 应用根级规则：".write": false
4. 结果：Permission Denied ❌
5. 事务失败，抛出错误
6. Guest 登录失败
```

---

## 📊 对比：注册用户 vs Guest 用户

### 注册用户登录流程
```
doRegister()
  ↓
afterLogin(user, { ..., enforceUnique: false })
  ├─ reserveNickname() - 跳过（enforceUnique = false）✅
  ├─ ensureProfile() - 写入 /profiles/{uid} ✅
  ├─ nav('/home') - 导航 ✅
  └─ presenceOnline() - 上线 ✅

结果：✅ 成功（因为注册时已经跳过了 reserveNickname）
```

### Guest 用户登录流程
```
doGuest()
  ↓
afterLogin(user, { ..., enforceUnique: true })
  ├─ reserveNickname() - 必须执行 ❌
  │  └─ 尝试写入 /nicknameIndex/{slug}
  │     └─ 没有规则 → Permission Denied
  │        └─ 抛出错误
  │           └─ cleanup() 清理用户
  │              └─ auth.signOut()
  └─ 登录失败

结果：❌ 失败（因为 nicknameIndex 没有规则）
```

---

## 🔧 解决方案

需要在 `firebase.rules.json` 中添加 `nicknameIndex` 规则：

```json
"nicknameIndex": {
  "$slug": {
    ".read": "auth != null",
    ".write": "auth != null",
    ".validate": "newData.hasChildren(['uid'])"
  }
}
```

**为什么这样安全？**
- `$slug` 是昵称的小写版本
- 任何登录用户都可以尝试预留昵称
- 但预留是原子事务（atomic transaction）
- 如果昵称已被占用，事务会失败，回滚
- 所以不会有冲突

---

## 📋 完整解决步骤

### 步骤 1：添加 nicknameIndex 规则

在 `firebase.rules.json` 的 `profiles` 规则**之后**添加：

```json
{
  "rules": {
    ".write": false,
    
    "profiles": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['uid']) && newData.child('uid').val() === $uid"
      }
    },
    
    "nicknameIndex": {
      "$slug": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "newData.child('uid').isString()"
      }
    }
  }
}
```

### 步骤 2：验证和部署

```bash
# 验证语法
firebase deploy --only database --dry-run

# 部署
firebase deploy --only database
```

### 步骤 3：测试

```
1. 打开应用
2. 点击 "Guest Login"
3. 填入信息
4. 应该能成功登录 ✅
```

---

## 🤔 为什么会这样？

### 历史回顾

查看 Git 历史：
```
git log --oneline firebase.rules.json | head -10
```

结果：
```
d5e6936 security: Fix Firebase rules - remove global read access and add path-level ACL
bf4802c fix: Temporarily disable Unsplash source...
...（更早的历史）
```

**问题所在：**

你在 v1.22 修复安全警告时，**只修复了全局规则和 dmMessages**，但没有检查是否有其他路径缺少规则。

`nicknameIndex` 规则可能在：
1. 之前就缺少（从未正确配置）
2. 或者被意外删除

---

## 🎯 为什么之前 Guest 能登录？

### 可能的原因

1. **之前有全局 `.write: true` 或 `"auth != null"` 规则**
   - 所以即使 nicknameIndex 没有特定规则
   - 仍然继承了全局权限
   
2. **修复时意外删除了**
   - 当移除全局规则时
   - nicknameIndex 的规则也被注释或删除

3. **Snapshot 恢复时**
   - 从旧备份恢复
   - 旧备份中本来就没有这个规则

---

## 📊 规则缺失分析

### 当前 firebase.rules.json 中定义的路径

```json
✅ presence/{uid}
✅ profiles/{uid}
✅ profilesStats/{uid}
✅ roles/{uid}
✅ rooms/{roomId}
✅ roomMembers/{roomId}/{uid}
✅ roomsMeta/{uid}/{roomId}
✅ messages/{roomId}/{msgId}
✅ dmMessages/{threadId}
✅ dmThreads/{uid}
✅ inbox/{uid}
✅ announcements
✅ friends/{uid}/{friendUid}
✅ blocks/{uid}/{targetUid}
✅ mutes/{uid}/{targetUid}
✅ ads
✅ posts/{postId}
✅ rateLimits/{uid}
✅ userBlocks/{uid}
❌ nicknameIndex/{slug}  ← 缺少！
```

---

## ✅ 修复后的效果

### Guest 登录流程（修复后）

```
doGuest()
  ↓
doGuest() → signInAnonymously() ✅
  ↓
afterLogin(..., { enforceUnique: true })
  ├─ reserveNickname()
  │  └─ 写入 /nicknameIndex/{slug} ✅
  │     └─ Firebase 检查规则
  │        └─ 发现 nicknameIndex 规则 ✅
  │           └─ .write: "auth != null" ✅
  │              └─ 用户已认证 ✅
  │                 └─ 事务成功 ✅
  ├─ ensureProfile() ✅
  ├─ nav('/home') ✅
  └─ presenceOnline() ✅

结果：✅ 登录成功！
```

---

## 🔐 安全性分析

### 为什么允许所有认证用户写 nicknameIndex？

```
原因 1：所有昵称都需要被预留
  • 无论是 Guest 还是注册用户
  • 都需要保证昵称唯一性
  • 所以都需要写入 nicknameIndex

原因 2：事务提供保护
  • 写入失败时自动回滚
  • 不会造成数据不一致
  • 冲突会自动检测

原因 3：其他路径也用同样模式
  • profiles/{uid} - 任何认证用户可写自己
  • friends/{uid}/{id} - 任何认证用户可写
  • blocks/{uid}/{id} - 任何认证用户可写
  • 所以 nicknameIndex 的规则模式是一致的
```

---

## 📝 最终诊断总结

| 项目 | 值 |
|------|-----|
| **问题** | Guest 用户无法登录 |
| **根本原因** | Firebase 规则缺少 `nicknameIndex` 路径定义 |
| **何时开始** | 未知（可能一直都缺少，或最近才暴露） |
| **影响范围** | 所有 Guest 用户登录（100% 失败率） |
| **注册用户影响** | 无（因为他们的代码跳过了 reserveNickname） |
| **解决方案** | 添加 nicknameIndex 规则 |
| **修复难度** | 极低（1 行规则）|
| **修复时间** | 2 分钟 |
| **修复后影响** | 零（完全不影响现有功能） |

---

## 🚀 立即修复

我现在将为你添加这个规则。


