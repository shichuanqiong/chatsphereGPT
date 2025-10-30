# ChatSphere 广告系统集成指南

## 📺 概览

ChatSphere 使用灵活的广告系统，支持：
- ✅ 占位符模式（开发/测试）
- ✅ Google AdSense
- ✅ 易于扩展（支持其他广告网络）

## 🎯 组件架构

```
TopAdPlaceholder.tsx
    ↓
ResponsiveAd.tsx (核心)
    ├─ type='placeholder' → 显示占位符
    └─ type='adsense' → 加载 AdSense 脚本并显示广告
```

---

## 📝 使用方式

### 1. 占位符模式（默认）

```tsx
import TopAdPlaceholder from '@/components/TopAdPlaceholder';

export default function Header() {
  return (
    <>
      {/* 基础占位符 */}
      <TopAdPlaceholder />
      
      {/* 悬浮占位符 */}
      <TopAdPlaceholder sticky={true} />
      
      {/* 自定义文字 */}
      <TopAdPlaceholder label="Premium Ad Space" />
    </>
  );
}
```

### 2. 切换为 AdSense

#### 步骤 1: 获取 AdSense 账户

1. 申请 [Google AdSense](https://www.google.com/adsense/)
2. 获取 **Client ID** (格式: `ca-pub-xxxxxxxxxxxxxxxx`)
3. 创建广告位并获取 **Slot ID**

#### 步骤 2: 配置环境变量

```env
# .env.local
VITE_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
VITE_ADSENSE_SLOT_ID=xxxxxxxxxxxxxxxx
```

#### 步骤 3: 更新组件

```tsx
import TopAdPlaceholder from '@/components/TopAdPlaceholder';

export default function Header() {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID || '';
  const slotId = import.meta.env.VITE_ADSENSE_SLOT_ID || '';

  return (
    <TopAdPlaceholder 
      type="adsense"
      clientId={clientId}
      slot={slotId}
    />
  );
}
```

---

## 🔧 ResponsiveAd 组件 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `'adsense' \| 'placeholder'` | `'placeholder'` | 广告类型 |
| `slot` | `string` | `''` | AdSense Slot ID |
| `clientId` | `string` | `''` | AdSense Client ID |
| `label` | `string` | `'Ad'` | 占位符文字 |
| `fallbackLabel` | `string` | `'Ad Space'` | 加载失败时显示的文字 |

### 使用示例

```tsx
import ResponsiveAd from '@/components/ResponsiveAd';

// 占位符
<ResponsiveAd type="placeholder" label="Ad Space" />

// AdSense
<ResponsiveAd 
  type="adsense"
  clientId="ca-pub-xxxxxxxxxxxxxxxx"
  slot="1234567890"
/>
```

---

## 📍 广告位置

### 顶部横幅（Top Banner）

```tsx
{/* 在 Header 中 */}
<TopAdPlaceholder />
```

**尺寸：**
- Desktop: 728×60px（标准）
- Mobile: 320×50px（自适应）

### 右侧栏广告（Right Rail）

```tsx
import RightAdPlaceholder from '@/components/RightAdPlaceholder';

export default function RightSidebar() {
  return (
    <aside className="flex flex-col gap-4 items-center">
      <RightAdPlaceholder />
      <RightAdPlaceholder />
      <RightAdPlaceholder />
    </aside>
  );
}
```

**尺寸：**
- Desktop: 300×250px（常见）或 336×280px
- 宽度: 320px（适配）
- 高度: 250px / 300px（响应式）
- 显示条件: `hidden lg:block`（仅桌面）

**切换为 AdSense：**

```tsx
<RightAdPlaceholder 
  type="adsense"
  clientId={import.meta.env.VITE_ADSENSE_CLIENT_ID}
  slot="right-rail-slot-id"
/>
```

### 移动端底部广告（Mobile Bottom）

```tsx
import MobileBottomAdPlaceholder from '@/components/MobileBottomAdPlaceholder';

export default function MobileBottomAd() {
  return <MobileBottomAdPlaceholder />;
}
```

**尺寸：**
- Mobile: 320×50px
- 显示条件: `hidden xl:block`（仅移动端）
- 位置: `fixed bottom-0`（固定底部）

**切换为 AdSense：**

```tsx
<MobileBottomAdPlaceholder 
  type="adsense"
  clientId={import.meta.env.VITE_ADSENSE_CLIENT_ID}
  slot="mobile-bottom-slot-id"
/>
```

### 其他位置（待实现）

```tsx
// 内嵌广告（文章中）
<InlineAd position="between-messages" />
```

---

## 🚀 部署前检查清单

### 开发环境
- [ ] 使用占位符模式测试 UI
- [ ] 确保广告容器不抖动（CLS < 0.1）
- [ ] 测试响应式设计

### 生产环境
- [ ] 申请 AdSense 账户
- [ ] 设置环境变量 (`VITE_ADSENSE_CLIENT_ID` 等)
- [ ] 构建并测试生产版本
- [ ] 监控 AdSense 收入
- [ ] 配置广告过滤规则

---

## 🎨 样式定制

### 修改占位符样式

编辑 `src/components/ResponsiveAd.tsx`:

```tsx
// 修改占位符样式
return (
  <div className="w-full h-full flex items-center justify-center 
    bg-gradient-to-r from-white/5 to-white/10 
    rounded-lg border border-dashed border-white/20">
    <span className="text-xs text-zinc-400/70">{label}</span>
  </div>
);
```

### 修改容器样式

编辑 `src/components/TopAdPlaceholder.tsx`:

```tsx
<div className="h-[48px] md:h-[60px] rounded-2xl border border-white/10 
  bg-white/5 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,.25)] 
  flex items-center justify-center overflow-hidden">
```

---

## ⚠️ 常见问题

### Q1: 广告显示不出来？

1. 检查 Client ID 和 Slot ID 是否正确
2. 确保 AdSense 账户已通过审核
3. 检查浏览器控制台是否有错误
4. 等待 AdSense 脚本加载（通常需要几秒）

### Q2: 广告导致页面抖动？

**已解决！** TopAdPlaceholder 预留了固定高度，防止 CLS。

### Q3: 如何禁用某些页面的广告？

```tsx
{/* 条件渲染 */}
{!isLoginPage && <TopAdPlaceholder />}
```

### Q4: 如何添加新的广告网络？

1. 在 `ResponsiveAd.tsx` 中添加新的 `type`
2. 实现相应的加载逻辑
3. 更新 `TopAdPlaceholder` 的 props

```tsx
export type AdType = 'adsense' | 'placeholder' | 'custom-network';

// 在 ResponsiveAd 中
if (type === 'custom-network') {
  // 实现自定义逻辑
}
```

---

## 📊 监控和优化

### 关键指标

- **页面加载时间** - 确保 < 3s
- **CLS 分数** - 确保 < 0.1
- **AdSense CTR** - 监控点击率
- **收入** - 追踪每天的收入

### 优化建议

1. **延迟加载广告** - 使用 Intersection Observer
2. **广告轮换** - 定期更换广告位置
3. **个性化广告** - 根据用户兴趣展示
4. **A/B 测试** - 测试不同的广告大小和位置

---

## 📚 相关资源

- [Google AdSense 官方文档](https://support.google.com/adsense/)
- [Web.dev CLS 指南](https://web.dev/cls/)
- [Responsive Ads 最佳实践](https://support.google.com/adsense/answer/3284236)

---

## 🔐 隐私和遵从性

- ✅ 遵守 Google AdSense 政策
- ✅ 显示隐私政策和数据处理说明
- ✅ 支持用户的广告偏好选择
- ✅ 不在登录/注册页面显示广告

---

最后更新：2025-10-30
