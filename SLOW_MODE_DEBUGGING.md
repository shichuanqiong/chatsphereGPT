# Slow Mode 调试指南

## 快速本地测试步骤

### 1. 启动开发服务器
```bash
pnpm dev
```
访问 `http://localhost:5173`

### 2. 打开浏览器控制台
- 按 `F12` 或 `Ctrl+Shift+I` 打开开发者工具
- 切换到 **Console** 标签页

### 3. 测试流程

#### 步骤 A：验证初始化
1. 刷新页面
2. 在控制台查看：
   ```
   [Admin] Loading settings from localStorage: null
   [Admin] No saved settings found, using defaults
   ```
   这表示没有已保存的设置（首次）

#### 步骤 B：设置 Slow Mode
1. 点击左侧菜单 **Settings**
2. 将 "Slow Mode (seconds)" 改为 **5**（或其他值）
3. 点击 **Save Settings** 按钮
4. 在控制台查看：
   ```
   System settings saved: {slowMode: 5, maxMessageLength: 5000, enableReports: true, ...}
   ✅ System settings saved successfully! (弹出框)
   ```

#### 步骤 C：验证保存
1. 刷新页面 (F5)
2. 再次进入 Settings
3. 应该看到 "Slow Mode" 显示 **5**（而不是 0）
4. 在控制台查看：
   ```
   [Admin] Loading settings from localStorage: {"slowMode":5,"maxMessageLength":5000,...}
   [Admin] Parsed settings: {slowMode: 5, maxMessageLength: 5000, ...}
   ```

#### 步骤 D：验证聊天中应用
1. 进入任何房间（Official Rooms 或 User Created Rooms）
2. 打开控制台（F12）
3. 尝试快速发送消息
4. 第一条应该发送成功
5. 立即尝试发送第二条
6. 在控制台查看：
   ```
   [Composer] Loaded slow mode from localStorage: 5
   [Composer] sendRecord: slowModeSeconds = 5, roomId = room-abc-123
   [Composer] Rate limit check result: {canSend: false, reason: "⏱️ Slow mode: wait 4s.", remainingSeconds: 4}
   ```
7. 应该看到提示：`⏱️ Slow mode: wait 4s.`
8. 发送按钮应该显示 `Wait 4s`（倒计时）

#### 步骤 E：测试 Spam 防护
1. 设置 Slow Mode = 0（禁用基础 slow mode）
2. 保存
3. 刷新
4. 进入房间
5. 快速发送 3 条消息（在 3 秒内）
6. 第 3 条时应该看到：
   ```
   [Composer] Rate limit check result: {triggered: true, reason: "🚫 Sending too fast! Auto-protection for 30s."}
   ```
7. 应该看到提示：`🚫 Sending too fast! Auto-protection for 30s.`

#### 步骤 F：测试 DM 豁免
1. 打开与某用户的 DM
2. 快速发送多条消息
3. 应该都能发送（不受限制）
4. 控制台不应该看到速率限制日志（因为 DM 跳过了整个 if 块）

---

## 常见问题诊断

### 问题：Slow Mode 设置后仍然是 0
**检查项**：
1. 在 Admin 面板，确认数值被改变了（输入框显示新值）
2. 点击 "Save Settings" 按钮时，看控制台是否有：
   ```
   System settings saved: {slowMode: X, ...}
   ```
3. 如果没有，说明 `handleSaveSettings` 没有被执行

**解决**：
- 检查浏览器控制台是否有错误
- 尝试刷新页面后重新设置

### 问题：设置保存成功，但刷新后又变成 0
**检查项**：
1. 刷新后在控制台查看：
   ```
   [Admin] Loading settings from localStorage: ...
   ```
2. 如果显示 `null`，说明 localStorage 被清空了

**可能原因**：
- localStorage 在无痕/隐身模式下不工作
- 浏览器隐私设置禁用了 localStorage
- localStorage 限额满了

**解决**：
- 在正常模式打开（不是无痕）
- 检查浏览器隐私设置
- 清空一些本地数据

### 问题：聊天中没有看到速率限制提示
**检查项**：
1. 控制台查看是否看到：
   ```
   [Composer] Loaded slow mode from localStorage: X
   [Composer] sendRecord: slowModeSeconds = X
   ```
2. 如果 `slowModeSeconds = 0`，说明没有加载到设置

**解决**：
- 重新进行步骤 B（再次设置 Slow Mode）
- 确保点击了 "Save Settings"
- 尝试在新标签页中打开房间（确保数据已同步）

### 问题：提示中显示 "Slow mode: wait 0s"
**原因**：速率限制已过期，倒计时显示为 0

**说明**：这是正常的，一秒后应该能发送

---

## 控制台日志解释

| 日志 | 含义 |
|------|------|
| `[Admin] Loading settings from localStorage: null` | 首次加载，无已保存设置 |
| `[Admin] Loading settings from localStorage: {"slowMode":5,...}` | 成功加载已保存设置 |
| `[Admin] Parsed settings: {slowMode: 5, ...}` | 设置解析成功，初始值为 5 秒 |
| `System settings saved: {slowMode: 5, ...}` | 用户点击保存，设置已写入 localStorage |
| `[Composer] Loaded slow mode from localStorage: 5` | Composer 成功读取到 slow mode 值 |
| `[Composer] sendRecord: slowModeSeconds = 5` | 准备发送消息，将使用 5 秒限制 |
| `[Composer] Rate limit check result: {canSend: false, ...}` | 消息被限制，用户需要等待 |
| `[Composer] Rate limit check result: {canSend: true}` | 消息可以发送 |

---

## 最小化可复现步骤

如果仍有问题，按这个步骤最小化测试：

1. 本地 `pnpm dev`
2. 登录（任何昵称）
3. 进入 Settings
4. 设置 Slow Mode = 10
5. 点击 Save（等待提示）
6. 刷新页面（F5）
7. Settings 应该显示 10（如果显示 0，问题在初始化）
8. 进入房间
9. 快速发两条消息
10. 第二条应该被提示限制（如果没有，问题在 Composer）

---

## 部署到 GitHub Pages

测试完成后，部署到 GitHub Pages：

```bash
# 本地构建
pnpm build

# GitHub 会自动检测 dist/ 文件夹变化
# 或者通过 GitHub Actions 自动部署（如果已配置）

git add -A
git commit -m "test: slow mode debugging complete"
git push origin main
```

GitHub Pages 会在几秒内更新。可在线访问：
https://shichuanqiong.github.io/chatsphereGPT/

**注意**：GitHub Pages 的 localStorage 可能有跨域限制，在线版本可能表现不同。

---

## 浏览器兼容性

| 浏览器 | localStorage 支持 | 注意 |
|------|---------|------|
| Chrome | ✅ | 调试最佳 |
| Firefox | ✅ | 调试最佳 |
| Safari | ✅ | 无痕模式下可能不工作 |
| Edge | ✅ | 与 Chrome 相同 |
| 无痕/隐身 | ⚠️ | localStorage 可能被禁用 |

---

## 下一步

如果本地测试成功但 GitHub Pages 不工作，可能原因：

1. **构建缓存** - GitHub Pages 缓存
   - 尝试在 GitHub 上手动触发 Actions
   - 或等待 5-10 分钟

2. **localStorage 跨域** - GitHub Pages 的 localStorage 作用域
   - 可能需要使用 sessionStorage 或其他存储方案

3. **浏览器缓存** - 你的浏览器缓存
   - 按 `Ctrl+Shift+R`（硬刷新）或清空缓存

---

## 快速命令

```bash
# 本地调试
pnpm dev

# 构建
pnpm build

# 部署
git push origin main

# 查看设置值
localStorage.getItem('system-settings')

# 清空设置（重置）
localStorage.removeItem('system-settings')

# 手动设置（控制台）
localStorage.setItem('system-settings', JSON.stringify({slowMode: 5, maxMessageLength: 5000, enableReports: true}))
```
