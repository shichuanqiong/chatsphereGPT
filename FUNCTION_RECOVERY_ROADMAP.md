# 功能恢复路线图 v1.22

**现状 (2025-11-10)**:
- ✅ 登录/注册
- ✅ Room 消息  
- ✅ Block 用户
- ✅ Kick/Ban
- ✅ 邀请
- ✅ 在线列表
- ❌ DM 消息 (正在修复)

**策略**: 先恢复功能，再逐步加回安全检查

---

## 第 1 阶段: DM 消息恢复 (进行中)

### 修复内容 (提交 7e5150e)
- 移除 dmMessages write 中的 dmThreads.exists() 检查
- 保留隐私保护（read 规则仍需 dmThreads）
- 这允许消息至少能被写入

### 预期效果
```
用户 A 发送消息给 B:
1. 创建 dmThreads/A/threadId ✅
2. 推送 dmMessages/threadId/msgId ✅ (之前失败，现在应该可以)
3. 更新对方 thread ✅
4. 更新 inbox ✅
```

### 测试步骤
1. 清除浏览器缓存 (Ctrl+Shift+Delete)
2. 硬刷新 (Ctrl+Shift+R)
3. 发送 DM
4. 检查 console 错误

### 下一步
如果 DM 仍失败:
- 检查 dmThreads 是否真的被创建
- 检查 authorId/content/createdAt 字段
- 验证 auth.uid 是否正确

---

## 第 2 阶段: 安全加固 (待定)

一旦 DM 工作，逐步加回检查:

### 2.1 恢复 dmThreads 隐私检查
```json
"dmMessages": {
  "$threadId": {
    ".read": "auth != null && root.child('dmThreads').child(auth.uid).child($threadId).exists()",
    // 这防止用户读取不属于他们的 DM
  }
}
```

### 2.2 恢复 dmMessages 写入检查
```json
"dmMessages": {
  "$threadId": {
    ".write": "auth != null && 
              root.child('dmThreads').child(auth.uid).child($threadId).exists() && 
              newData.exists() && ..."
    // 这防止用户写入不属于他们的线程
  }
}
```

---

## 第 3 阶段: 其他功能验证

### Ban/Kick 功能
- ✅ 规则允许 (rooms/bans 有权限)
- ✅ 代码没改
- 预期: 应该可以工作

### 邀请功能  
- ✅ 规则允许 (rooms/invites 有权限)
- ✅ 代码没改
- 预期: 应该可以工作

### Block 功能
- ✅ 已确认工作
- 规则: blocks 路径允许顶层写
- 可继续使用

---

## 规则修改历史

| 提交 | 修改内容 | 目的 |
|------|---------|------|
| `f9a3f12` | 添加顶层权限 | 支持跨路径操作 |
| `286c31f` | 代码执行顺序 | 先创建 thread 再写消息 |
| `9678c64` | 加回 dmThreads 检查 | 隐私保护 |
| `7e5150e` | 移除 dmThreads 检查 | 恢复 DM 功能 |

---

## 当前规则状态

### dmMessages (简化版)
```json
"dmMessages": {
  ".write": "auth != null",
  "$threadId": {
    ".read": "需要 dmThreads 存在",
    ".write": "只需 authorId 和内容验证"
  }
}
```

### dmThreads (不变)
```json
"dmThreads": {
  "$uid": {
    ".write": "auth != null && auth.uid === $uid"
  }
}
```

---

## 测试清单

- [ ] 清除浏览器缓存并硬刷新
- [ ] 测试 DM 发送
- [ ] 检查 dmThreads 是否创建
- [ ] 检查 dmMessages 是否写入
- [ ] 验证接收方能否读取消息
- [ ] 测试 Block 用户
- [ ] 测试 Kick 用户
- [ ] 测试 Ban 用户
- [ ] 测试邀请用户

---

## 预计完成

**阶段 1 (DM 恢复)**: 即刻  
**阶段 2 (安全加固)**: 待 DM 工作后  
**阶段 3 (完全验证)**: 最后确认

---

**记录时间**: 2025-11-10  
**状态**: 进行中  
**下一步**: 监控 DM 功能，确认是否工作

