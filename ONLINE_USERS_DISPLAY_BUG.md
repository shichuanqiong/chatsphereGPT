# 在线用户列表无法显示 - 根本原因诊断

**问题时间：** 2025-11-06  
**现象：** 修改规则后，在线用户列表显示为 0
**根本原因：** Firebase 规则缺少根级路径的 `.read` 定义

---

## 🔍 问题分析

### 代码中的读取操作

```typescript
// src/hooks/useOnlineUsers.ts 第 115 行
const profilesSnap = await get(ref(db, 'profiles'));  // ← 读取 /profiles 根节点
```

### Firebase 规则检查

当代码尝试读取 `/profiles` 时，Firebase 检查规则：

```json
"profiles": {
  "$uid": {
    ".read": "auth != null",  // ← 这只适用于 /profiles/{uid}
    ...                       // 不适用于 /profiles 本身！
  }
}
```

**规则缺陷：**
```
用户请求：GET /profiles
Firebase 检查规则树：
  ├─ 根级 .read? ❌ 无定义
  ├─ profiles/.read? ❌ 无定义
  └─ profiles/$uid/.read? ✅ 有定义，但这是 /profiles/{uid} 的规则
  
结果：Permission Denied ❌
错误信息：User does not have permission to read path "/profiles"
```

---

## 📊 为什么之前能工作？

**之前的规则（v1.22 之前）：**
```json
// 曾有全局规则或路径级规则
"profiles": {
  ".read": "auth != null",  // ← 根级读权限存在
  "$uid": {
    ...
  }
}
```

**现在的规则：**
```json
"profiles": {
  "$uid": {
    ".read": "auth != null"  // ← 只有 $uid 级，没有根级
  }
}
```

---

## 🔧 解决方案

需要在 `profiles` 路径添加根级 `.read` 规则：

```json
"profiles": {
  ".read": "auth != null",  // ← 添加这行
  "$uid": {
    ".read": "auth != null",
    ".write": "auth != null && auth.uid === $uid",
    ".validate": "newData.hasChildren(['uid']) && newData.child('uid').val() === $uid"
  }
}
```

**为什么这样安全？**
- `profiles` 中存储的是公开用户档案（nickname, age, gender, country）
- 任何登录用户都应该能看到其他用户的基本信息（这是应用设计）
- 敏感信息（email, password）不存储在 `profiles`
- 涉及隐私的数据（如 inbox, dm threads）有单独的 `/$uid/` 级保护

---

## 📋 其他可能受影响的路径

检查哪些路径可能缺少根级 `.read` 规则：

| 路径 | 根级 .read | 问题 | 影响 |
|------|-----------|------|------|
| `presence` | ❌ 无 | 📍 可能影响 | onValue(ref(db, 'presence')) |
| `profiles` | ❌ 无 | 📍 **现在的问题** | get(ref(db, 'profiles')) |
| `rooms` | ❌ 无 | 📍 可能影响 | onValue(ref(db, 'rooms')) |
| `profiles` | ❌ 无 | 📍 可能影响 | get(ref(db, 'profiles')) |
| `messages` | ❌ 无 | 📍 可能影响 | onValue(ref(db, 'messages')) |
| `announcements` | ✅ 有 | ✅ 已定义 | |
| `ads` | ✅ 有 | ✅ 已定义 | |
| `posts` | ❌ 无 | 📍 可能影响 | 如果读整个路径 |

---

## ✅ 修复步骤

### 第 1 步：添加根级 `.read` 规则

需要为以下路径添加根级 `.read`：

```json
{
  "rules": {
    ...
    
    "presence": {
      ".read": "auth != null",  // ← 添加
      "$uid": {
        ".read": "auth != null",
        ".write": "auth.uid === $uid",
        ".validate": "newData.hasChildren(['state', 'lastSeen'])"
      }
    },
    
    "profiles": {
      ".read": "auth != null",  // ← 添加
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['uid']) && newData.child('uid').val() === $uid"
      }
    },
    
    "rooms": {
      ".read": "auth != null",  // ← 添加（允许查看公开房间列表）
      "$roomId": {
        ".read": "auth != null && (root.child('rooms').child($roomId).child('visibility').val() === 'public' || root.child('roomMembers').child($roomId).child(auth.uid).exists())",
        ...
      }
    },
    
    "messages": {
      ".read": false,  // ← 添加（防止直接读整个 messages）
      "$roomId": {
        "$msgId": {
          ".read": "auth != null && root.child('roomMembers').child($roomId).child(auth.uid).exists()",
          ...
        }
      }
    },
    
    "posts": {
      ".read": false,  // ← 添加（防止直接读整个 posts）
      "$postId": {
        ".read": "auth != null && (root.child('posts').child($postId).child('visibility').val() === 'public' || root.child('posts').child($postId).child('authorId').val() === auth.uid)",
        ...
      }
    },
    
    ...
  }
}
```

### 第 2 步：验证和部署

```bash
firebase deploy --only database --dry-run
firebase deploy --only database
```

### 第 3 步：测试

应该能看到在线用户列表了 ✅

---

## 🎯 关键要点

| 项目 | 说明 |
|------|------|
| **问题** | 规则缺少根级 `.read` 定义 |
| **影响** | 读取 `/profiles`、`/presence` 等整个路径时失败 |
| **原因** | Firebase 规则采用树形结构，必须为每个层级定义权限 |
| **修复** | 添加根级 `.read` 规则 |
| **安全** | 仍然受 `$uid` 级别的访问控制保护 |

---

## 📝 Firebase 规则结构说明

```
规则树结构示例：

/profiles (根级)
  .read: auth != null  ← 允许读 /profiles
  
  /profiles/{uid} (用户级)
    .read: auth != null  ← 允许读 /profiles/{uid}
    
    /profiles/{uid}/name (字段级)
    /profiles/{uid}/age (字段级)
```

**重要概念：**
- 权限不会向下自动继承
- 必须在**每个需要保护的层级**定义规则
- 如果某层没有规则定义，则应用父级规则
- 如果父级也没有，则应用根级规则
- 如果根级也没有，则应用全局 `.read: false, .write: false`



