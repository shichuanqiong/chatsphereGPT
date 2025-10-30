# 🔍 快速调试指南 - 音频 404 问题

## 问题表现
所有音频文件返回 404（媒体请求全红）：
- ❌ `https://shichuanqiong.github.io/sfx/ding.mp3` 404
- ❌ `https://shichuanqiong.github.io/sfx/ding.ogg` 404
- ❌ `https://shichuanqiong.github.io/sfx/ding.wav` 404

**根本原因**：GitHub Pages 还没有发布 `gh-pages` 分支中的文件

---

## 快速诊断步骤

### 第 1 步：检查 GitHub Actions 状态

访问：https://github.com/shichuanqiong/chatsphereGPT/actions

**查看最新的 workflow 运行**：

| 状态 | 含义 | 处理 |
|------|------|------|
| 🟢 Success | 部署成功 | 跳到第 3 步 |
| 🟡 In Progress | 还在运行 | 等待 2-3 分钟 |
| 🔴 Failed | 部署失败 | 看下面的错误处理 |
| ⚪ No runs | 从未运行 | 手动触发（见下） |

### 第 2 步：如果没有运行或想加速，手动触发

1. 打开 Actions 页面
2. 左边选择 "Deploy to GitHub Pages"
3. 点击右边的 "Run workflow" 按钮
4. 弹窗中点 "Run workflow" 确认
5. 等待 2-3 分钟完成

### 第 3 步：验证 gh-pages 分支

如果 workflow 成功，应该自动创建 `gh-pages` 分支

1. 打开：https://github.com/shichuanqiong/chatsphereGPT/branches
2. 查看分支列表
3. 应该看到 `gh-pages` 分支（新的，和 main 同级）

**如果没有 gh-pages 分支**：
- Workflow 没有运行成功
- 检查 Action 的详细错误日志

### 第 4 步：检查 GitHub Pages 设置

1. 打开 Settings：https://github.com/shichuanqiong/chatsphereGPT/settings/pages
2. 查看 **Source** 配置，应该显示：
   ```
   Deploy from a branch
   Branch: gh-pages / (root)
   ```

**如果显示其他分支或路径**：
- 手动改成 `gh-pages` / `(root)`
- 等待 1-2 分钟自动部署

### 第 5 步：验证文件是否存在

如果 gh-pages 分支存在，检查文件：

1. 打开：https://github.com/shichuanqiong/chatsphereGPT/tree/gh-pages
2. 应该看到：
   ```
   dist/
   ├── index.html
   ├── assets/
   ├── sfx/
   │   ├── ding.mp3 ✓
   │   ├── ding.ogg ✓
   │   └── ding.wav ✓
   └── robots.txt
   ```

**如果没有 sfx 文件夹**：
- Build 步骤失败了
- 查看 workflow 日志中的 Build 错误

---

## 常见错误和解决方案

### ❌ 错误 1：Workflow 显示 Failed（红色）

**处理**：
1. 点击失败的 run
2. 点击 "build" job
3. 找到红色 ❌ 的 step
4. 查看具体错误

**常见错误**：
- `pnpm install` 失败 → 本地运行 `pnpm install` 测试
- `build` 失败 → 本地运行 `pnpm run build` 测试
- `upload-pages-artifact` 失败 → 检查 dist 是否生成

### ❌ 错误 2：GitHub Pages 设置不对

**检查**：https://github.com/shichuanqiong/chatsphereGPT/settings/pages

应该看到：
```
Deployment branch
Branch: gh-pages
Deploy from a branch

Your site is live at https://shichuanqiong.github.io/chatsphereGPT/
```

**如果显示其他**：
- 手动改成 `gh-pages`
- 点 Save 等待部署

### ❌ 错误 3：gh-pages 分支不存在

**可能原因**：
1. Workflow 从未成功运行
2. 之前的 workflow 设置有问题（已修复）

**解决**：
```bash
# 本地手动创建并推送
git checkout --orphan gh-pages
git rm -rf .
echo "temp" > index.html
git add index.html
git commit -m "Initial gh-pages"
git push origin gh-pages

# 切换回 main 继续开发
git checkout main
```

然后再手动触发新的 workflow。

---

## 快速验证清单

按顺序检查，全部 ✅ 即可：

- [ ] GitHub Actions 最新 workflow 显示 ✅ Success
- [ ] gh-pages 分支存在（检查 branches 页面）
- [ ] GitHub Pages Source 配置为 `gh-pages` / `(root)`
- [ ] gh-pages 分支包含 `dist/sfx/` 文件夹
- [ ] 直接访问 `https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.wav` 返回 200
- [ ] 刷新网站后 Console 显示正确路径（含 `/chatsphereGPT/`）
- [ ] Network 标签中 sfx 文件返回 200（不是 404）

---

## 🧪 本地快速诊断

如果要确保本地构建没问题，运行：

```bash
# 1. 确保依赖最新
pnpm install

# 2. 构建并检查 dist/sfx
pnpm run build
ls -la dist/sfx/

# 3. 检查 vite 配置
grep "base:" vite.config.ts

# 输出应该是：
# base: '/chatsphereGPT/',
```

---

## 🚀 如果还是不行 - 终极方案

手动部署 dist 到 gh-pages：

```bash
# 1. 确保本地构建成功
pnpm run build
ls -la dist/sfx/  # 验证 sfx 文件存在

# 2. 临时创建部署分支
git checkout --orphan gh-pages-deploy

# 3. 清空并复制 dist
git rm -rf .
cp -r dist/* .
echo ".gitignore" > .gitignore  # 可选

# 4. 提交
git add -A
git commit -m "manual deploy: copy dist to gh-pages"

# 5. 推送到 gh-pages
git push origin gh-pages-deploy:gh-pages -f

# 6. 切换回 main
git checkout main
git branch -D gh-pages-deploy
```

部署后，等待 1-2 分钟 GitHub Pages 更新，然后硬刷新网站。

---

## 📞 信息收集

如果问题持续，请收集以下信息：

1. **GitHub Actions 状态**：
   - 最新 workflow 是 Success 还是 Failed？
   - 如果 Failed，什么 step 失败？

2. **分支检查**：
   - gh-pages 分支是否存在？
   - gh-pages 中是否有 sfx 文件夹？

3. **GitHub Pages 设置**：
   - Source 配置是什么？
   - 显示的网站 URL 是什么？

4. **网站状态**：
   - Console 中显示的音频路径是什么？
   - Network 中 sfx 文件的完整 URL 是什么？

有了这些信息就能快速定位问题！
