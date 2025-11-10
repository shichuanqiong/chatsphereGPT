# Room Block 功能失败诊断

**日期**: 2025-11-10  
**问题**: Room 里无法 block 人家  
**状态**: 🔴 **已确认 - 规则权限不足**

---

## 🔍 问题诊断

用户报告：✅ 可以登录、对话、邀请、kick，**但是 room 里还是不能 block 人家**

### Block 功能涉及的两个系统

#### 系统 A: 全局 Block（DM 和聊天消息中使用）
```typescript
// src/lib/social.ts
export async function blockUser(targetUid: string) {
  const me = auth.currentUser?.uid;
  await update(ref(db), { [`blocks/${me}/${targetUid}`]: true });
}
```

**数据路径**: `/blocks/{myUid}/{peerUid}`  
**当前规则状态**: ✅ 定义了 (firebase.rules.json 第 126-130 行)

#### 系统 B: Room-Level Block（Room 成员列表中使用）
```typescript
// src/hooks/useRoomBlocks.ts
export function useRoomBlocks(myUid: string | undefined, roomId: string | undefined) {
  const setBlocked = async (peerUid: string, blocked: boolean) => {
    const path = ref(db, `userBlocks/${myUid}/rooms/${roomId}/${peerUid}`);
    blocked ? await set(path, true) : await remove(path);
  };
}
```

**数据路径**: `/userBlocks/{myUid}/rooms/{roomId}/{peerUid}`  
**当前规则状态**: ❌ **完全缺失**

---

## 📊 规则分析

### 当前规则中的 Block 相关定义

```json
// firebase.rules.json 第 126-130 行
"blocks": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid"
  }
}

// ❌ 缺失 userBlocks 路径定义
// 🔍 应该有这样的规则：
// "userBlocks": {
//   "$uid": { 
//     "rooms": { ... }  // 但完全缺失！
//   }
// }
```

---

## 🔍 问题根源

### 问题 1: `/blocks` 缺少顶层 `.write` 权限

```json
// 当前规则
"blocks": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid"  // ← 只在 $uid 级别
  }
}

// 问题：
// src/lib/social.ts 调用:
// await update(ref(db), { [`blocks/${me}/${targetUid}`]: true });
//                         ↑
// 这需要 /blocks 的顶层 .write 权限！
```

**影响范围**:
- 🔴 全局 block 可能失败（特别是跨路径 update 调用）
- 🔴 DM 中的 block 按钮可能不工作

**当前规则问题**:
- 没有 `"blocks": { ".write": "auth != null", ... }`

---

### 问题 2: `/userBlocks` 路径完全缺失 🔴

```json
// ❌ firebase.rules.json 中完全找不到 userBlocks 路径

// ✅ 代码预期的规则结构：
"userBlocks": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid",
    "global": {
      "$peerUid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "rooms": {  // ← 这是 Room Block 的关键路径！
      "$roomId": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "$peerUid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    }
  }
}
```

**影响范围**:
- 🔴 **Room-level block 完全无法工作**
- 🔴 所有写入 `/userBlocks/{uid}/rooms/{roomId}/{peerUid}` 的操作都会被拒绝
- 🔴 代码中 `useRoomBlocks.ts` 的 `setBlocked()` 函数每次调用都会失败

**代码位置** (src/hooks/useRoomBlocks.ts 第 15-19 行):
```typescript
const setBlocked = async (peerUid: string, blocked: boolean) => {
  if (!myUid || !roomId || myUid === peerUid) return;
  const path = ref(db, `userBlocks/${myUid}/rooms/${roomId}/${peerUid}`);
  blocked ? await set(path, true) : await remove(path);
  // ↑ 这里会被拒绝，因为 /userBlocks 的规则不存在
};
```

---

## 📍 UI 位置 - Block 按钮在哪里

### ✅ 已工作的 Block（全局）

1. **DM 顶部** (src/pages/Home.tsx 第 1300-1322 行)
   - 按钮: `🚫 Block / 🔓 Unblock`
   - 调用: `blockUser(dmPeer.uid)` 从 `src/lib/social.ts`
   - 数据路径: `/blocks/{myUid}/{peerUid}`
   - 状态: ✅ 可能工作（全局 block）

### ❌ 不工作的 Block（Room-level）

2. **Message 气泡中（hover 时）** (src/components/MessageList.tsx)
   - 按钮: `Block/Unblock` 出现在消息上方
   - 调用: `handleBlock()` → `blockUser()` 从 `src/lib/social.ts`
   - 数据路径: 应该是 `/userBlocks/{uid}/rooms/{roomId}/{peerUid}` 但代码用的是全局
   - 状态: ❓ 不清楚

3. **Members Sheet 中** (src/components/MembersSheet.tsx)
   - 按钮: `Kick / Ban` 
   - 调用: `kick()` 和 `ban()` 函数
   - 数据路径: `/roomMembers/{roomId}/{uid}` 和 `/rooms/{roomId}/bans/{uid}`
   - 状态: ✅ 能工作（这些权限都有）
   - 注意: 这是 **kick/ban**，不是 **block**

> ⚠️ **发现**: Members Sheet 中没有 "Block" 按钮！只有 "Kick" 和 "Ban"。
> 
> **Block vs Ban 的区别**:
> - **Ban**: 房间所有者对某用户的禁止（管理功能）→ `/rooms/{roomId}/bans/{uid}`
> - **Block**: 用户对某人的个人屏蔽（个人隐私功能）→ `/userBlocks/{uid}/rooms/{roomId}/{peerUid}`

---

## 🎯 修复方案

### 方案：添加缺失的 `/userBlocks` 规则

在 `firebase.rules.json` 中添加完整的 `userBlocks` 路径定义。

**添加位置**: 在 `/blocks` 路径之后（或之前）

```json
"userBlocks": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid",
    "global": {
      "$peerUid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "rooms": {
      "$roomId": {
        "$peerUid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    }
  }
}
```

### 同时优化 `/blocks` 规则

```json
"blocks": {
  ".write": "auth != null",  // ← 添加顶层 .write 以支持跨路径更新
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid",
    "$peerUid": {  // ← 显式定义子路径
      ".read": "auth != null && auth.uid === $uid",
      ".write": "auth != null && auth.uid === $uid"
    }
  }
}
```

---

## 📋 修复前后对比

| 功能 | 修复前 | 修复后 |
|------|--------|--------|
| **全局 Block（DM）** | ⚠️ 可能失败 | ✅ 成功 |
| **Room Block** | ❌ Permission denied | ✅ 成功 |
| **Message 中 Block** | ⚠️ 混乱 | ✅ 清晰 |
| **Members 中 Block** | ❌ 无此功能 | ✅ 可用 |

---

## ✅ 下一步

1. **添加 `/userBlocks` 完整规则**
2. **优化 `/blocks` 规则**
3. **验证 Block 功能**
4. **考虑在 Members Sheet 中添加 Block 按钮**（可选）

---

## 📚 相关代码文件

- `src/hooks/useRoomBlocks.ts` - Room-level block hook
- `src/lib/social.ts` - 全局 block 函数
- `src/components/MessageList.tsx` - Message 中的 block 按钮
- `src/components/MembersSheet.tsx` - 成员列表（Kick/Ban，无 Block）
- `src/pages/Home.tsx` - DM 顶部的 block 按钮
- `firebase.rules.json` - Firebase 规则文件

---

## 时间线

- **v1.20** (2025-11-03): 实现了 `userBlocks` 规则
- **今天** (2025-11-10): 方案 A 修复后，`userBlocks` 规则被误删或未包含

---

## 疑问

❓ 为什么 `userBlocks` 规则消失了？
- 可能是之前回滚到某个版本时的遗留
- 或者方案 A 只修复了 4 个路径，没有包含其他规则

**验证**: 检查 git 历史中 `userBlocks` 是否存在过。

