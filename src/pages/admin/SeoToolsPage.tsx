import React, { useEffect, useState, useMemo } from 'react';
import { useSeo, type SeoConfig } from '@/seo/SeoProvider';
import { Copy, ExternalLink, AlertCircle } from 'lucide-react';

type FormState = SeoConfig & { isDirty: boolean; errors: Record<string, string> };

function Field({ 
  label, 
  hint, 
  error, 
  children 
}: { 
  label: string; 
  hint?: string;
  error?: string;
  children: React.ReactNode 
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
      </div>
      {children}
      {error && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
      {hint && !error && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
    </label>
  );
}

export default function SeoToolsPage() {
  const { cfg, refresh } = useSeo();
  const [form, setForm] = useState<FormState>({
    ...cfg,
    isDirty: false,
    errors: {},
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(prev => ({
      ...cfg,
      isDirty: false,
      errors: prev.errors,
    }));
  }, [cfg]);

  // 验证 URL
  const validateUrl = (url: string, fieldName: string): string | undefined => {
    if (!url) return `${fieldName} 不能为空`;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return `${fieldName} 必须使用 https://`;
      if (!url.includes('chatsphere.app') && !url.includes('localhost')) {
        return `${fieldName} 只允许 chatsphere.app 或 localhost`;
      }
    } catch {
      return `${fieldName} 格式无效`;
    }
    return undefined;
  };

  // 验证 Keywords - 去重、去空格、限制数量
  const validateAndCleanKeywords = (keywords: string): { cleaned: string; error?: string } => {
    const arr = keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    const unique = [...new Set(arr)];
    
    if (unique.length > 10) {
      return { 
        cleaned: unique.slice(0, 10).join(', '),
        error: '最多 10 个关键词（已自动截断）'
      };
    }

    return { cleaned: unique.join(', ') };
  };

  // 更新表单字段
  const set = (k: keyof Omit<FormState, 'isDirty' | 'errors'>, v: any) => {
    const newForm = { ...form, [k]: v, isDirty: true };
    
    // 验证
    const errors = { ...form.errors };
    
    if (k === 'canonicalBase') {
      const err = validateUrl(v, 'Canonical URL');
      if (err) errors[k] = err;
      else delete errors[k];
    }
    
    if (k === 'ogImage') {
      const err = validateUrl(v, 'OG Image URL');
      if (err) errors[k] = err;
      else delete errors[k];
    }

    if (k === 'keywords') {
      const { cleaned, error } = validateAndCleanKeywords(v);
      newForm.keywords = cleaned;
      if (error) errors[k] = error;
      else delete errors[k];
    }

    newForm.errors = errors;
    setForm(newForm);
  };

  // 保存
  async function save() {
    const hasErrors = Object.keys(form.errors).length > 0;
    if (hasErrors) {
      alert('❌ 请先修复错误');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          keywords: form.keywords,
          canonicalBase: form.canonicalBase,
          ogImage: form.ogImage,
          twitterCard: form.twitterCard,
          robotsTxt: form.robotsTxt,
        }),
      });

      if (res.ok) {
        await refresh();
        setForm(prev => ({ ...prev, isDirty: false }));
        alert('✅ SEO 配置已保存');
      } else {
        alert('❌ 保存失败（Mock 模式）');
        setForm(prev => ({ ...prev, isDirty: false }));
      }
    } catch (e) {
      alert('❌ 网络错误');
    } finally {
      setSaving(false);
    }
  }

  async function regenSitemap() {
    try {
      const res = await fetch('/api/admin/seo/sitemap:regenerate', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        alert('✅ Sitemap 已重新生成');
      } else {
        alert('❌ 生成失败（Mock 模式）');
      }
    } catch (e) {
      alert('❌ 网络错误');
    }
  }

  // Meta 代码片段（用于复制）
  const metaSnippet = useMemo(() => {
    const canonical = `<link rel="canonical" href="${form.canonicalBase}${typeof window !== 'undefined' ? window.location.pathname : ''}" />`;
    const og = `<meta property="og:title" content="${form.title.replace(/"/g, '&quot;')}" />
<meta property="og:description" content="${form.description.replace(/"/g, '&quot;')}" />
<meta property="og:image" content="${form.ogImage}" />`;
    const twitter = `<meta name="twitter:card" content="${form.twitterCard}" />
<meta name="twitter:title" content="${form.title.replace(/"/g, '&quot;')}" />
<meta name="twitter:description" content="${form.description.replace(/"/g, '&quot;')}" />`;
    return `${canonical}\n\n${og}\n\n${twitter}`;
  }, [form]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('✅ 已复制到剪贴板');
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg, #14E3C1 0%, #6A5CFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🔍 SEO Tools
            </h1>
            <p className="text-zinc-400 mt-1">Manage SEO metadata, robots.txt & sitemap</p>
          </div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${form.isDirty ? 'text-yellow-400' : 'text-green-400'}`}>
              {form.isDirty ? '● Unsaved' : 'Saved ✓'}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* 基础 SEO */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">基础信息</h2>
          <div className="space-y-4">
            <Field label="页面标题 (Title)" hint="60–70 字符最佳">
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                maxLength={70}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
              />
              <div className="text-xs text-zinc-500 mt-1">{form.title.length}/70</div>
            </Field>

            <Field label="描述 (Meta Description)" hint="150–160 字符为佳，搜索结果可见">
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={160}
                className="w-full min-h-[90px] px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none resize-none"
              />
              <div className="text-xs text-zinc-500 mt-1">{form.description.length}/160</div>
            </Field>

            <Field label="关键词 (Keywords)" hint="逗号分隔，最多 10 个，自动去重" error={form.errors.keywords}>
              <input
                value={form.keywords}
                onChange={(e) => set('keywords', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
              />
            </Field>
          </div>
        </div>

        {/* 社交媒体 */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Social & Open Graph</h2>
          <div className="space-y-4">
            <Field 
              label="规范 URL (Canonical Base)" 
              hint="系统自动在每个页面注入 <link rel=\"canonical\">，无需手动在 HTML 中重复"
              error={form.errors.canonicalBase}
            >
              <input
                value={form.canonicalBase}
                onChange={(e) => set('canonicalBase', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl bg-white/10 text-white border transition-all outline-none ${form.errors.canonicalBase ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-white/30'}`}
              />
            </Field>

            <Field 
              label="Open Graph 图像 URL"
              hint="推荐尺寸：1200×630px，<512KB"
              error={form.errors.ogImage}
            >
              <input
                value={form.ogImage}
                onChange={(e) => set('ogImage', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl bg-white/10 text-white border transition-all outline-none ${form.errors.ogImage ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-white/30'}`}
              />
            </Field>

            <Field label="Twitter Card 类型">
              <select
                value={form.twitterCard}
                onChange={(e) => set('twitterCard', e.target.value as 'summary' | 'summary_large_image')}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              >
                <option value="summary" style={{ color: 'white', backgroundColor: '#1a1f35' }}>summary (小卡片)</option>
                <option value="summary_large_image" style={{ color: 'white', backgroundColor: '#1a1f35' }}>summary_large_image (大图)</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Robots.txt */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Robots.txt</h2>
            <button
              onClick={() => {
                const defaultRobots = `User-agent: *
Disallow: /admin
Allow: /

Sitemap: https://chatsphere.app/sitemap.xml`;
                set('robotsTxt', defaultRobots);
              }}
              className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition"
            >
              🔄 恢复默认
            </button>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={form.robotsTxt}
                onChange={(e) => set('robotsTxt', e.target.value)}
                className="w-full min-h-[160px] px-4 py-3 rounded-xl bg-black/20 text-white border border-white/10 focus:border-white/30 transition-all outline-none resize-none font-mono text-sm"
              />
            </div>
            <p className="text-xs text-zinc-500">搜索引擎爬虫的抓取规则</p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={saving || !form.isDirty}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {saving ? '💾 保存中...' : '💾 保存配置'}
          </button>
          <button
            onClick={regenSitemap}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            🗺️ 重新生成 Sitemap
          </button>
          <a
            href="https://developers.facebook.com/tools/debug/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl font-semibold text-white bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 transition-all flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" /> Facebook Debugger
          </a>
          <a
            href="https://cards-dev.twitter.com/validator"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl font-semibold text-white bg-blue-400/20 border border-blue-300/30 hover:bg-blue-400/30 transition-all flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" /> Twitter Validator
          </a>
        </div>

        {/* Google Search 预览 */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">📱 Google Search 预览</h2>
          <div className="bg-white text-black p-4 rounded-lg space-y-1">
            <div className="text-sm text-blue-600 font-semibold">{form.canonicalBase}</div>
            <div className="text-xl font-semibold text-black">{form.title}</div>
            <div className="text-sm text-gray-700">{form.description}</div>
          </div>
        </div>

        {/* OG/Twitter 卡片预览 */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">🎴 社交卡片预览</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OG 预览 */}
            <div className="border border-white/20 rounded-lg overflow-hidden bg-white">
              <img 
                src={form.ogImage} 
                alt="OG" 
                className="w-full h-40 object-cover bg-gray-300" 
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              <div className="p-3 text-black">
                <div className="text-xs text-gray-600 mb-1">Open Graph</div>
                <div className="font-semibold text-sm line-clamp-2">{form.title}</div>
                <div className="text-xs text-gray-600 line-clamp-2">{form.description}</div>
              </div>
            </div>

            {/* Twitter 预览 */}
            <div className="border border-white/20 rounded-lg overflow-hidden bg-gray-900 text-white">
              {form.twitterCard === 'summary_large_image' && (
                <img 
                  src={form.ogImage} 
                  alt="Twitter" 
                  className="w-full h-40 object-cover bg-gray-700"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div className="p-3">
                <div className="text-xs text-gray-400 mb-1">Twitter Card</div>
                <div className="font-semibold text-sm line-clamp-2">{form.title}</div>
                <div className="text-xs text-gray-400 line-clamp-2">{form.description}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta 代码片段 */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">📋 Meta 代码片段</h2>
            <button
              onClick={() => copyToClipboard(metaSnippet)}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              <Copy className="h-3 w-3" /> 复制
            </button>
          </div>
          <pre className="bg-black/30 p-4 rounded-lg text-xs text-green-400 overflow-x-auto font-mono">
{metaSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
