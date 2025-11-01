# 密码重置弹窗功能验收测试

## 📋 实现清单

✅ **新增组件**: `src/components/auth/ResetPasswordModal.tsx`
- 深色主题设计，完全使用 Tailwind inline 样式
- 支持邮箱输入、加载状态、成功/错误提示
- 焦点自动聚焦到输入框
- 点击背景或 Cancel 按钮关闭

✅ **修改文件**: `src/pages/Login.tsx`
- 导入 `ResetPasswordModal` 组件
- 添加移动端检测逻辑（`window.matchMedia('(max-width: 768px)')`）
- 修改"Forgot Password?"按钮的点击处理

✅ **未改动文件**（严格遵守）:
- ❌ `src/styles/mobile.css` — 未修改
- ❌ `src/hooks/useIOSKeyboard.ts` — 未修改
- ❌ 其他桌面端样式/组件

---

## 🧪 验收测试步骤

### 测试 1：手机端打开弹窗

**环境**: Chrome/Safari DevTools 模拟移动设备 (max-width: 768px) 或实际手机
**步骤**:
1. 导航到登录页面 `https://shichuanqiong.github.io/chatsphereGPT/#/`
2. 点击 "Forgot Password?" 按钮
3. **预期**:
   - ✅ 深色弹窗出现（background: neutral-900）
   - ✅ 标题 "Reset password" 可见
   - ✅ 邮箱输入框自动获得焦点（cursor blinking）
   - ✅ 背景有黑色半透明遮罩 + 高斯模糊

### 测试 2：输入邮箱并发送

**前置**: 弹窗已打开
**步骤**:
1. 输入有效邮箱地址，例如 `test@example.com`
2. 点击 "Send" 按钮
3. **预期**:
   - ✅ 按钮文字变为 "Sending…"，按钮禁用
   - ✅ 输入框禁用（灰显）
   - ✅ 1-2 秒后显示绿色成功提示："Password reset email sent. Please check your inbox."
   - ✅ 弹窗自动关闭（1.5 秒后）

### 测试 3：发送失败

**前置**: 弹窗已打开
**步骤**:
1. 输入不存在的邮箱 `nonexistent@test.com`
2. 点击 "Send" 按钮
3. **预期**:
   - ✅ 显示红色错误提示，如："There is no user record corresponding to this identifier."
   - ✅ 弹窗保持打开，允许重新尝试
   - ✅ "Send" 按钮可再次点击

### 测试 4：关闭弹窗

**前置**: 弹窗已打开
**步骤**:
1. 点击 "Cancel" 按钮 **或** 点击背景遮罩
2. **预期**:
   - ✅ 弹窗立即关闭
   - ✅ 输入框内容被清空
   - ✅ 加载状态重置

### 测试 5：桌面端保持原有行为

**环境**: 宽度 > 768px 的浏览器
**步骤**:
1. 导航到登录页面
2. 点击 "Forgot Password?" 按钮
3. **预期**:
   - ✅ 弹出系统 `prompt()` 对话框（与之前完全相同）
   - ✅ 不显示自定义弹窗
   - ✅ 输入邮箱后按 OK，执行原有逻辑

### 测试 6：响应式 + 输入框焦点

**环境**: 手机或模拟设备
**步骤**:
1. 打开弹窗
2. **预期**:
   - ✅ 弹窗宽度为屏幕宽度的 92%（`w-[92%]`），最大 `max-w-sm`
   - ✅ 邮箱输入框可见且易于点击（至少 44px 高度）
   - ✅ 字体大小不会因 iOS Safari 自动缩放而变化
   - ✅ 输入法弹出时，弹窗不会被遮挡

### 测试 7：深色主题审美

**预期**:
- ✅ 背景色为深灰/黑色（`bg-neutral-900`）
- ✅ 文字颜色为浅灰色（`text-neutral-200`）
- ✅ 输入框背景为 `bg-neutral-800`
- ✅ 边框为白色半透明（`border-white/10`）
- ✅ 焦点环（`focus:ring-white/20`）
- ✅ Send 按钮为渐变色（`from-cyan-400 to-blue-500`）
- ✅ 整体风格与登录页一致

---

## 🔍 代码审查要点

- [ ] `ResetPasswordModal.tsx` 中的所有样式均为 Tailwind inline class，无额外 CSS 文件
- [ ] 未修改 `src/styles/mobile.css`
- [ ] 未修改 `src/hooks/useIOSKeyboard.ts`
- [ ] 手机端检测使用 `window.matchMedia('(max-width: 768px)')`
- [ ] Firebase `sendPasswordResetEmail` 调用正确
- [ ] 错误处理覆盖：网络错误、邮箱不存在、其他异常
- [ ] 成功/失败提示清晰

---

## 📝 逐步自测清单

- [ ] **手机端** 打开弹窗，输入有效邮箱，接收成功提示并自动关闭
- [ ] **手机端** 输入无效邮箱，查看错误提示，点 Cancel 关闭
- [ ] **手机端** 点击背景遮罩，弹窗关闭
- [ ] **桌面端** 点击"Forgot Password?"，弹出系统 prompt
- [ ] **网络错误** 场景：禁用网络或拔网线，查看错误处理
- [ ] **iOS/Android** 实机测试，验证输入框焦点和输入法交互
- [ ] **z-index** 检查：弹窗在最上层（z-[1000]）
- [ ] **颜色对比** 检查：确保文字可读性

---

## 📱 浏览器/设备兼容性

- [ ] Chrome 移动版
- [ ] Safari 移动版 (iOS)
- [ ] Firefox 移动版
- [ ] 实际手机设备（iOS 15+, Android 11+）

---

## ✅ 最终验收

如果所有上述测试通过，该功能已准备好部署。
