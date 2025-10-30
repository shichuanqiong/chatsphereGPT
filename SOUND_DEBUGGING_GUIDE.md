# 声音系统调试指南

## 快速诊断

### 1. 打开浏览器控制台
按 `F12`，切换到 **Console** 标签

### 2. 检查初始化状态
刷新页面后，在控制台应该看到：
```
[Sound] Initialized. Muted: false
```

如果显示 `Muted: true`，声音被静音了 → 需要取消静音

---

## 诊断步骤

### 问题 1：没有声音，但没有错误

#### 检查清单
1. **用户交互是否发生**
   - 在控制台查看是否有：
     ```
     [Sound] Audio unlocked by user interaction
     ```
   - 如果没有，说明音频还未解锁（需要点击或按键）
   - 尝试点击或按任何键，然后查看控制台

2. **是否被静音**
   - 查看初始化日志：`Muted: false` ✓ 或 `Muted: true` ✗
   - 在控制台手动检查：
     ```javascript
     Sound.isMuted()  // 返回 false = 未静音 ✓，返回 true = 已静音 ✗
     ```

3. **取消静音（如果被静音了）**
   ```javascript
   Sound.forceUnmute()
   // 控制台应该显示：
   // [Sound] Unmuted
   // [Sound] Force unmuted and unlocked
   ```

### 问题 2：收到未读消息但没有声音

#### 完整测试流程

**步骤 A：手动播放测试**

1. 在控制台执行：
   ```javascript
   Sound.play('ding')
   ```

2. 查看控制台输出（应该看到类似的日志）：
   ```
   [Sound] Playing: ding - Unlocked: true
   [Sound] Trying source 1/2: /sfx/new-notification-010-352755.mp3
   [Sound] Playing new Audio instance...
   [Sound] ✅ Successfully played: /sfx/new-notification-010-352755.mp3
   ```

3. **如果听到声音** ✅
   - 说明声音系统正常
   - 问题可能在未读消息触发逻辑

4. **如果没有声音** ✗
   - 查看是否有错误日志
   - 继续诊断下面的问题

**步骤 B：检查音频文件**

在浏览器地址栏直接访问：
```
http://localhost:5173/sfx/new-notification-010-352755.mp3
```

或在线版本：
```
https://shichuanqiong.github.io/chatsphereGPT/sfx/new-notification-010-352755.mp3
```

- 如果能直接播放 → 文件 OK ✓
- 如果 404 或无法播放 → 文件问题 ✗

### 问题 3：收到未读消息时没有触发声音

#### 检查未读消息逻辑

1. **打开另一个浏览器标签页发送消息给你**

2. **在主标签页的控制台查看**：
   - 应该看到 `[Sound] Playing: ding - Unlocked: ...`
   - 如果没有，说明 `Sound.play('ding')` 没有被调用

3. **检查未读计数**
   ```javascript
   // 查看是否有未读
   document.body.innerHTML.includes('unread')
   ```

---

## 常见错误及解决

### 错误：`[Sound] Muted - skipping playback`
**原因**：声音被静音了  
**解决**：
```javascript
Sound.unmute()
// 或
Sound.forceUnmute()  // 同时解锁
```

### 错误：`[Sound] Audio not unlocked yet`
**原因**：还没有用户交互，浏览器禁止自动播放  
**解决**：
- 点击页面或按键来解锁
- 或在控制台执行：`Sound.forceUnmute()`

### 错误：`[Sound] Failed to play source 1/2`
**原因**：音频源加载失败  
**检查**：
1. 网络是否正常（检查 Network 标签）
2. 文件是否存在（试试直接访问 URL）
3. 尝试 CDN 备用源是否工作

### 错误：`[Sound] All audio sources failed`
**原因**：所有音频源都失败  
**诊断**：
1. 检查浏览器是否支持 MP3
2. 尝试在其他浏览器测试
3. 检查音频文件是否损坏

---

## 完整的控制台命令

```javascript
// 查看静音状态
Sound.isMuted()

// 取消静音
Sound.unmute()

// 静音
Sound.mute()

// 强制解锁和取消静音（调试用）
Sound.forceUnmute()

// 手动播放声音
Sound.play('ding')

// 查看 localStorage 中的静音状态
localStorage.getItem('mute')

// 清除静音状态（重置）
localStorage.removeItem('mute')

// 测试音频支持
const audio = new Audio()
audio.canPlayType('audio/mpeg')  // 返回 "probably" 或 "" 或 "maybe"
```

---

## 浏览器兼容性检查

### Chrome / Edge
```javascript
new Audio().canPlayType('audio/mpeg')  // → "probably"
```

### Firefox
```javascript
new Audio().canPlayType('audio/mpeg')  // → "probably"
```

### Safari
```javascript
new Audio().canPlayType('audio/mpeg')  // → "maybe"
```

### 无痕/隐身模式
可能禁用 localStorage，导致静音状态无法保存，但不影响播放

---

## 完整测试清单

- [ ] 控制台显示：`[Sound] Initialized. Muted: false`
- [ ] 点击页面后，控制台显示：`[Sound] Audio unlocked by user interaction`
- [ ] 执行 `Sound.play('ding')` 听到声音
- [ ] 收到未读消息时听到声音
- [ ] 静音/取消静音功能正常
- [ ] 刷新后静音状态保持（localStorage）

---

## 本地 vs GitHub Pages

### 本地开发 (`pnpm dev`)
- ✅ 音频文件路径：`/sfx/new-notification-010-352755.mp3`
- ✅ 调试最佳（完整日志）
- ✅ 无跨域限制

### GitHub Pages (`github.io`)
- 音频文件路径：`/chatsphereGPT/sfx/new-notification-010-352755.mp3`
  - 因为 base URL 是 `/chatsphereGPT/`
- 可能有跨域限制
- 如果本地工作但线上不工作，可能需要调整路径

---

## 如果仍然无效

### 收集调试信息

在控制台执行以下命令，把输出复制给我：

```javascript
console.log('=== Sound Debug Info ===');
console.log('Muted:', Sound.isMuted());
console.log('Unlocked:', Sound.unlocked);
console.log('Audio support:', new Audio().canPlayType('audio/mpeg'));
console.log('localStorage.mute:', localStorage.getItem('mute'));
console.log('===');

// 测试播放
Sound.forceUnmute();
Sound.play('ding');
```

---

## 快速修复方案

如果都不行，尝试：

1. **清空浏览器缓存**
   - Ctrl+Shift+Delete（或 Cmd+Shift+Delete on Mac）
   - 清空所有缓存
   - 刷新页面

2. **尝试不同浏览器**
   - Chrome
   - Firefox
   - Safari

3. **检查音频文件**
   - 确保 `/sfx/new-notification-010-352755.mp3` 存在且可访问
   - 文件大小应该是几十 KB

4. **强制解锁** (应急方案)
   ```javascript
   Sound.forceUnmute();
   Sound.play('ding');
   ```
