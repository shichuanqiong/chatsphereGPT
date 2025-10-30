# Admin API Setup Guide

## Environment Variables

在项目根目录创建 `.env.local` 文件（不要提交到 git），包含以下内容：

```env
VITE_API_BASE=https://us-central1-chatspheregpt.cloudfunctions.net/api
VITE_ADMIN_KEY=ChatSphere2025Secure!@#$%
```

## 使用 API

### 导入 API 客户端

```typescript
import { AdminAPI } from '@/lib/api';
```

### 获取汇总指标

```typescript
const data = await AdminAPI.summary();
// Returns: { online: number, msg24h: number, dau: number }
```

### 获取 24 小时消息分桶

```typescript
const data = await AdminAPI.buckets();
// Returns: { buckets: Array<{h: number, c: number}> }
```

### 获取热门房间

```typescript
const data = await AdminAPI.topRooms();
// Returns: { rooms: Array<{name: string, count: number}> }
```

### 实时数据流（SSE）

```typescript
const unsubscribe = AdminAPI.stream((data) => {
  console.log('Real-time metrics:', data);
  // data: { online, msg24h, dau, buckets, rooms }
});

// 停止监听
unsubscribe();
```

## 部署状态

✅ **第 1 步**: ADMIN_KEY 已设置  
✅ **第 2 步**: Functions 导出名称正确  
⏳ **第 3 步**: 等待 Firebase Blaze 升级后部署  
⏳ **第 4 步**: 创建初始 Firestore 文档（待 Functions 部署后）  
✅ **第 5 步**: 环境变量配置已准备  
✅ **第 6 步**: API 客户端已创建（`src/lib/api.ts`）

## 升级 Firebase 到 Blaze 计划

Firebase Cloud Functions 需要 Blaze（按量计费）计划。访问：
https://console.firebase.google.com/project/chatspheregpt/usage/details

升级完成后，运行：
```bash
firebase deploy --only functions
```

