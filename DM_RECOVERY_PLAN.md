# DM 功能恢复计划 - 系统诊断

**现状**: 
- ✅ Room 消息可以发送
- ✅ Block 用户可以使用  
- ❌ DM 消息无法发送

**分析**:

## 问题 1: DM 的特殊性

Room 消息写入路径:
```
/messages/{roomId}/{msgId}
```
规则:
```json
".write": "auth != null && ..."
```
✅ 可以工作

DM 消息写入路径:
```
/dmMessages/{threadId}/{msgId}
```
规则:
```json
".write": "auth != null && root.child('dmThreads').child(auth.uid).child($threadId).exists() && ..."
```
❌ 需要先检查 dmThreads

## 问题 2: 执行顺序

代码改了顺序，但可能：
1. 浏览器缓存问题
2. dmThreads 创建失败但没有错误处理
3. push() 调用仍然使用旧的条件

## 恢复策略

### 第一步: 简化 dmMessages 规则（临时）
移除 dmThreads 检查，让 DM 至少能写入

### 第二步: 确保 dmThreads 先创建
改进代码中的错误处理和日志

### 第三步: 逐步恢复其他功能
Ban/Kick/邀请等

### 第四步: 最终加回 dmThreads 检查
恢复完整的隐私保护

