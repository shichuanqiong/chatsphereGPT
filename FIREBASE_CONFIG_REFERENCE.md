# Firebase 配置参考

## 项目信息

| 项目 | 值 |
|------|-----|
| **项目名称** | ChatSphereGPT |
| **项目 ID** | chatspheregpt |
| **项目编号** | 421775686973 |

---

## Firebase Web 应用配置

### 基础配置

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD-M3CM2Y0o9TkuYoPX1ShjUd3zENviIGc",
  authDomain: "chatspheregpt.firebaseapp.com",
  projectId: "chatspheregpt",
  storageBucket: "chatspheregpt.firebasestorage.app",
  messagingSenderId: "421775686973",
  appId: "1:421775686973:web:c10b0c50f1af2759569954",
  databaseURL: "https://chatspheregpt-default-rtdb.firebaseio.com",
};
```

### API Keys 分解

| 项目 | 值 |
|------|-----|
| **Web API Key** | `AIzaSyD-M3CM2Y0o9TkuYoPX1ShjUd3zENviIGc` |
| **Auth Domain** | `chatspheregpt.firebaseapp.com` |
| **Database URL** | `https://chatspheregpt-default-rtdb.firebaseio.com` |
| **Storage Bucket** | `chatspheregpt.firebasestorage.app` |
| **Messaging Sender ID** | `421775686973` |
| **App ID** | `1:421775686973:web:c10b0c50f1af2759569954` |

---

## GitHub Actions Secrets

这些值已保存在 GitHub Repository Secrets：
https://github.com/shichuanqiong/chatsphereGPT/settings/secrets/actions

```
✅ VITE_FIREBASE_API_KEY
✅ VITE_FIREBASE_AUTH_DOMAIN
✅ VITE_FIREBASE_PROJECT_ID
✅ VITE_FIREBASE_STORAGE_BUCKET
✅ VITE_FIREBASE_MESSAGING_SENDER_ID
✅ VITE_FIREBASE_APP_ID
✅ VITE_FIREBASE_DATABASE_URL
✅ VITE_FIREBASE_MEASUREMENT_ID（可选）
```

---

## Firebase Console 链接

| 项 | 链接 |
|----|------|
| **Firebase 项目** | https://console.firebase.google.com/project/chatspheregpt |
| **Authentication 设置** | https://console.firebase.google.com/project/chatspheregpt/authentication/settings |
| **Realtime Database** | https://console.firebase.google.com/project/chatspheregpt/database |
| **Authorized Domains** | https://console.firebase.google.com/project/chatspheregpt/authentication/settings |

---

## 授权域名

已添加的授权域名：

```
✅ localhost (Default)
✅ chatspheregpt.firebaseapp.com (Default)
✅ chatspheregpt.web.app (Default)
✅ shichuanqiong.github.io (Custom - GitHub Pages)
```

---

## 本地开发配置

### .env.local（本地开发用，不提交到 Git）

```env
VITE_FIREBASE_API_KEY=AIzaSyD-M3CM2Y0o9TkuYoPX1ShjUd3zENviIGc
VITE_FIREBASE_AUTH_DOMAIN=chatspheregpt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chatspheregpt
VITE_FIREBASE_STORAGE_BUCKET=chatspheregpt.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=421775686973
VITE_FIREBASE_APP_ID=1:421775686973:web:c10b0c50f1af2759569954
VITE_FIREBASE_DATABASE_URL=https://chatspheregpt-default-rtdb.firebaseio.com
VITE_FIREBASE_MEASUREMENT_ID=（可选）
```

---

## 代码中的使用

### src/firebase.ts

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
```

---

## 安全说明

⚠️ **重要**：
- **不要**提交 `.env.local` 到 Git（已在 `.gitignore` 中）
- **不要**在代码中硬编码敏感密钥
- **仅在** GitHub Actions Secrets 中存储敏感信息
- **定期检查** Firebase Console 中的授权域名
- **监控** API 使用情况和配额

---

## 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| Firebase 初始化失败 | 环境变量未正确注入 | 检查 GitHub Actions Secrets 是否正确设置 |
| auth/invalid-api-key | API Key 无效或过期 | 验证 Firebase 控制台中的 Web API Key |
| Origin not authorized | 域名未授权 | 在 Firebase Auth 设置中添加授权域名 |
| Invalid base URL (sound.ts) | URL 构造失败 | 确保 BASE_URL 环境变量正确 |

---

## 相关文件

- `src/firebase.ts` - Firebase 初始化代码
- `src/lib/sound.ts` - 音频加载（使用 BASE_URL）
- `.github/workflows/deploy.yml` - GitHub Actions 部署配置
- `.env.local` - 本地环境变量（不提交）
- `.gitignore` - 忽略敏感文件

---

**最后更新**：2025-10-30  
**状态**：✅ 生产就绪（Production Ready）
