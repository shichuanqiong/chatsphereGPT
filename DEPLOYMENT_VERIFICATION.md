# 🔍 GitHub Pages 部署故障排查指南

## 快速诊断清单

### 第 1 步：检查 GitHub Actions 状态

访问：https://github.com/shichuanqiong/chatsphereGPT/actions

**查看最新的 "Deploy to GitHub Pages" workflow 运行**：

| 状态 | 含义 | 下一步 |
|------|------|--------|
| ✅ Success | 部署成功 | 跳到第 4 步（硬刷新网站） |
| 🔄 In Progress | 还在运行 | 等待 2-3 分钟再刷新 |
| ❌ Failed | 部署失败 | 看失败原因（见第 2 步） |

### 第 2 步：如果失败，查看详细日志

1. 点击失败的 workflow run
2. 点击 "Deploy to GitHub Pages" job
3. 展开失败的 step（看红色 ❌ 标记）
4. 查看错误信息

**常见错误和解决方案**：

#### ❌ 错误 1：`pnpm install` 失败
```
error: ERR_PNPM_INSTALL_FAIL
```
**原因**：pnpm-lock.yaml 损坏或依赖不兼容
**解决**：
```bash
# 本地重新生成 lock 文件
pnpm install
git add pnpm-lock.yaml
git commit -m "fix: regenerate pnpm lock file"
git push origin main
```

#### ❌ 错误 2：`pnpm run build` 失败
```
error: Command failed
```
**原因**：代码编译错误
**解决**：
1. 本地运行 `pnpm run build` 测试
2. 查看具体错误信息
3. 修复代码后提交

#### ❌ 错误 3：`dist` 文件夹为空
```
publish_dir: ./dist not found
```
**原因**：构建没有输出 dist 文件夹
**解决**：
1. 检查 `vite.config.ts` 是否正确
2. 本地运行 `pnpm run build` 验证
3. 确保 `public/sfx/` 文件夹存在

---

## 第 3 步：验证 gh-pages 分支

如果 workflow 显示成功但网站还是旧的，检查 GitHub Pages 设置：

1. 打开：https://github.com/shichuanqiong/chatsphereGPT/settings/pages
2. 查看 **Source** 配置，应该显示：
   ```
   Deploy from a branch
   Branch: gh-pages / (root)
   ```

**如果不是 gh-pages**：
1. 手动改成 `gh-pages`
2. 等待 1-2 分钟部署

---

## 第 4 步：硬刷新网站并验证

### 4.1 硬刷新浏览器
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### 4.2 打开 Console 检查路径
F12 → Console，应该看到：
```
[Sound] Trying: https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.mp3
[Sound] Trying: https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.ogg
[Sound] ✅ Played: https://shichuanqiong.github.io/chatsphereGPT/sfx/ding.wav
```

### 4.3 检查 Network 请求
F12 → Network，过滤 `sfx`，验证：
- ✅ ding.mp3 → 200
- ✅ ding.ogg → 200
- ✅ ding.wav → 200

### 4.4 测试声音
收到未读消息时，应该有声音 🔊

---

## 完整诊断流程

```mermaid
graph TD
    A["访问 GitHub Actions"] --> B{"最新 Workflow\n状态?"}
    B -->|✅ Success| C["检查 gh-pages\n分支存在?"]
    B -->|❌ Failed| D["查看失败日志"]
    B -->|🔄 Running| E["等待 2-3 分钟"]
    
    D --> F{"错误类型?"}
    F -->|pnpm install| G["重新生成\npnpm-lock.yaml"]
    F -->|build failed| H["本地测试构建\n修复错误"]
    F -->|other| I["查看详细日志\n获取帮助"]
    
    C -->|否| J["手动创建\ngh-pages 分支"]
    C -->|是| K["硬刷新网站\nCtrl+Shift+R"]
    
    K --> L{"路径是否\n包含仓库名?"}
    L -->|是| M{"是否\n有声音?"]
    L -->|否| N["清除浏览器\n缓存"]
    
    M -->|是| O["✅ 成功!"]
    M -->|否| P["检查 Network\n标签"]
```

---

## 一键诊断命令

在你的本地终端运行，收集诊断信息：

```bash
# 1. 检查本地构建
echo "=== Local Build Test ==="
pnpm run build
echo ""

# 2. 检查 dist/sfx 文件
echo "=== Checking dist/sfx ==="
ls -la dist/sfx/
echo ""

# 3. 检查 public/sfx 文件
echo "=== Checking public/sfx ==="
ls -la public/sfx/
echo ""

# 4. 检查 vite 配置
echo "=== Checking vite.config.ts ==="
grep "base:" vite.config.ts
echo ""

# 5. 推送到 GitHub
echo "=== Pushing to GitHub ==="
git add -A
git commit -m "test: trigger workflow"
git push origin main
```

运行后，再检查 GitHub Actions 的最新 workflow 日志。

---

## 如果问题持续存在

请收集以下信息并反馈：

1. **GitHub Actions 日志截图**
   - 失败的 step 的完整错误信息
   
2. **本地构建状态**
   ```bash
   pnpm run build 2>&1 | tail -20
   ```
   
3. **文件检查**
   ```bash
   ls -la dist/sfx/
   ls -la public/sfx/
   ```

4. **浏览器 Console 日志**
   - 完整的 [Sound] 日志输出

5. **Network 标签**
   - sfx 文件的请求 URL 和响应状态码

---

## 预期时间表

| 步骤 | 时间 |
|------|------|
| 代码推送到 GitHub | 即时 |
| GitHub Actions 开始运行 | < 1 分钟 |
| 构建和部署完成 | 2-3 分钟 |
| GitHub Pages 更新 | 自动 |
| 浏览器缓存刷新 | 1 秒 |
| **总计** | **5 分钟** |

---

## 最后一招：手动部署

如果 GitHub Actions 持续失败，可以手动部署：

```bash
# 1. 确保本地构建成功
pnpm run build

# 2. 创建/切换到 gh-pages 分支
git checkout --orphan gh-pages

# 3. 删除所有文件并复制 dist
git rm -rf .
cp -r dist/* .
git add -A
git commit -m "deploy: manual deployment from dist"

# 4. 推送到 gh-pages
git push origin gh-pages -f

# 5. 切换回 main
git checkout main
```

部署后，检查 GitHub Pages 设置确保从 gh-pages 发布。

