# 🚀 GitHub Pages 部署验证指南

## 📋 刚刚做了什么

1. ✅ 创建了 `.github/workflows/deploy.yml`
2. ✅ 配置 GitHub Actions 自动构建 `dist/` 
3. ✅ 自动将 `dist/` 部署到 `gh-pages` 分支
4. ✅ GitHub Pages 会从 `gh-pages` 分支发布网站

---

## ✅ 验证部署状态

### 步骤 1：检查 GitHub Actions

1. 打开你的仓库：https://github.com/shichuanqiong/chatsphereGPT
2. 点击 **Actions** 选项卡
3. 查看最新的 workflow 运行状态
4. 应该看到 "Deploy to GitHub Pages" 任务
5. 等待状态变为 ✅ **Success**（通常需要 2-3 分钟）

```
✅ Deploy to GitHub Pages
   ├─ ✅ Checkout code
   ├─ ✅ Setup Node.js
   ├─ ✅ Install pnpm
   ├─ ✅ Install dependencies
   ├─ ✅ Build
   └─ ✅ Deploy to GitHub Pages
```

### 步骤 2：检查 GitHub Pages 发布分支

1. 打开仓库设置：https://github.com/shichuanqiong/chatsphereGPT/settings/pages
2. 查看 **Source** 部分
3. 应该显示：
   ```
   Deploy from a branch
   Branch: gh-pages / (root)
   ```

---

## 🎵 验证音频文件

### 方式 1：检查 gh-pages 分支内容

1. 打开仓库代码页面
2. 切换分支到 `gh-pages`
3. 验证存在：
   ```
   sfx/
   ├── ding.mp3
   ├── ding.ogg
   ├── ding.wav
   ├── pop_soft.wav
   └── ...
   ```

### 方式 2：直接访问文件 URL

在浏览器中打开这些 URL 测试：

```
https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.mp3
https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.ogg
https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.wav
```

预期结果：**200 OK**，能下载音频文件

### 方式 3：在应用中验证

1. 硬刷新网页：https://shichuanqiong.github.io/chatsphereGPT/
   ```
   Ctrl + Shift + R
   ```

2. 打开浏览器 Console（F12 → Console）

3. 应该看到：
   ```
   [Sound] Trying: https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.mp3
   [Sound] Trying: https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.ogg
   [Sound] ✅ Played: https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.wav
   ```

4. 打开 Network 标签，过滤 `sfx`
5. 所有请求应该返回 **200** 状态码

---

## 📊 部署架构

```
main 分支
    ↓
push 触发 Actions
    ↓
Build (pnpm run build)
    ↓ 输出 dist/ 文件夹
    ├── index.html
    ├── assets/
    └── sfx/
        ├── ding.mp3 ✅
        ├── ding.ogg ✅
        └── ding.wav ✅
    ↓
Deploy to gh-pages 分支
    ↓
GitHub Pages 发布
    ↓
https://shichuanqiong.github.io/chatsphereGPT/ 👈 你的网站
```

---

## 🔍 文件部署验证清单

- [ ] GitHub Actions "Deploy to GitHub Pages" 显示 ✅ Success
- [ ] gh-pages 分支存在 (https://github.com/shichuanqiong/chatsphereGPT/tree/gh-pages)
- [ ] gh-pages 分支包含 `sfx/` 文件夹
- [ ] gh-pages 中的 `sfx/ding.wav` 等文件存在
- [ ] 直接访问 `https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.wav` 返回 200
- [ ] Console 显示正确的路径（含 `/chatsphereGPT/`）
- [ ] Network 标签显示所有 sfx 文件返回 200
- [ ] 收到未读消息时有声音 🔊

---

## ⚠️ 常见问题

### 问题 1：Actions 显示失败（Failed）
**原因**：可能是依赖安装失败或构建出错
**解决**：
1. 点击失败的 workflow
2. 查看详细日志
3. 通常是 `pnpm install` 失败，检查 `pnpm-lock.yaml` 是否损坏

### 问题 2：gh-pages 分支不存在
**原因**：首次部署需要创建分支
**解决**：
1. 再等 1-2 分钟让 workflow 完成
2. 如果还是不行，手动创建空分支：
   ```bash
   git checkout --orphan gh-pages
   git rm -rf .
   git commit --allow-empty -m "Initial commit"
   git push origin gh-pages
   ```

### 问题 3：还是 404 for sfx files
**原因**：dist 构建时没有复制 public 文件夹
**解决**：确认 Vite 配置正确：
```typescript
// vite.config.ts
export default defineConfig({
  base: '/chatsphereGPT/',
})
```
Vite 会自动复制 `public/` 到 `dist/`

### 问题 4：部署了但还是看到旧的网站
**解决**：
1. 硬刷新浏览器（Ctrl+Shift+R）
2. 清空浏览器缓存
3. 隐身窗口测试
4. 等待 DNS 缓存过期（通常 5 分钟）

---

## 📝 下一步

1. ✅ 等待 GitHub Actions 完成（2-3 分钟）
2. ✅ 验证 gh-pages 分支已创建
3. ✅ 验证 sfx 文件在 gh-pages 中
4. ✅ 硬刷新网站并测试音频
5. ✅ 检查 Console 日志
6. ✅ 收到未读消息时验证声音

**预期结果**：
- 路径正确：`https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.wav` ✅
- 文件返回 200 ✅
- 有声音 🔊 ✅

---

## 🎯 如果部署后仍有问题

请提供以下信息：
1. GitHub Actions 最新 workflow 的运行状态（Success/Failed）
2. Console 中的完整日志
3. Network 标签中 sfx 文件的请求和响应
4. gh-pages 分支是否存在

这样可以更快地定位问题！
