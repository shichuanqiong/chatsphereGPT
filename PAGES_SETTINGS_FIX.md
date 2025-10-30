# 🔧 GitHub Pages 设置修复

## ⚠️ 问题

你把 GitHub Pages 设置改成了 `Source: GitHub Actions`，但我们用的是 `peaceiris/actions-gh-pages`，它需要 `Deploy from a branch` 配置。

**结果**：部署冲突 → 404 错误

---

## ✅ 修复步骤（4 步）

### Step 1: 打开 GitHub Pages 设置

访问：https://github.com/shichuanqiong/chatsphereGPT/settings/pages

### Step 2: 修改 Build and deployment

找到 **Build and deployment** 部分

### Step 3: 修改 Source

**改前**：`Source: GitHub Actions`
**改后**：`Source: Deploy from a branch`

点击下拉菜单，选择 **Deploy from a branch**

### Step 4: 选择正确的分支

**Branch**: 选 `gh-pages`
**Folder**: 选 `(root)` 或 `/`

然后点 **Save**

---

## 验证正确配置

修改后应该看到：

```
Build and deployment
  ├─ Source: Deploy from a branch ✅
  ├─ Branch: gh-pages / (root) ✅
  └─ Status: Your site is live at https://shichuanqiong.github.io/chatsphereGPT/
```

---

## 为什么要这样配置？

| 设置方式 | 说明 | 兼容性 |
|---------|------|--------|
| ❌ GitHub Actions | 官方新方案，但需要特定的 actions/deploy-pages | 不兼容 peaceiris |
| ✅ Deploy from a branch (gh-pages) | 传统方案，从分支部署 | 完美兼容 peaceiris |

我们用 `peaceiris/actions-gh-pages`，它直接将构建结果推送到 `gh-pages` 分支，所以必须选 **"Deploy from a branch"** 并指向 `gh-pages`。

---

## 修改后的效果

1. GitHub Actions 工作流运行
2. peaceiris action 将 dist/ 推送到 gh-pages 分支
3. GitHub Pages 从 gh-pages 分支发布网站
4. 网站上线 ✅

---

## 修改完后的验证

1. **修改 GitHub Pages 设置**（上面的 4 步）
2. **等待 1-2 分钟**
3. **硬刷新网站**：https://shichuanqiong.github.io/chatsphereGPT/
   ```
   Ctrl + Shift + R
   ```
4. **应该不再是 404**
5. **检查 Console**（F12）：应该看到 `[Sound] Constructed URL: /chatsphereGPT/sfx/...`
6. **检查 Network**（过滤 `sfx`）：应该全是 200 OK

---

## 快速参考图

```
GitHub Pages 设置界面：

┌─ Build and deployment
│
├─ Source:
│  └─ [Deploy from a branch] ✅ (选这个)
│
├─ Branch:
│  └─ gh-pages / (root) ✅
│
└─ Status:
   └─ Your site is live at https://shichuanqiong.github.io/chatsphereGPT/
```

---

## 注意

⚠️ 不要选 `GitHub Actions` 源，那是给官方工作流用的。

我们用的 `peaceiris/actions-gh-pages` 是**第三方 action**，它只管推送到 gh-pages 分支，剩下的由 GitHub Pages 的"分支部署"功能处理。

---

🎉 修改完成后，GitHub Actions 工作流会继续运行，peaceiris 会更新 gh-pages，然后网站就会恢复正常！
