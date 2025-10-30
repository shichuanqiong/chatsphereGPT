import { useEffect, useRef } from 'react';

export type AdType = 'adsense' | 'placeholder';

interface ResponsiveAdProps {
  slot?: string;                    // AdSense slot ID
  type?: AdType;                    // 广告类型
  clientId?: string;                // AdSense client ID
  label?: string;                   // 占位符文字
  fallbackLabel?: string;           // 加载失败时的文字
}

export default function ResponsiveAd({
  slot = '',
  type = 'placeholder',
  clientId = '',
  label = 'Ad',
  fallbackLabel = 'Ad Space',
}: ResponsiveAdProps) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // AdSense 加载逻辑
    if (type === 'adsense' && slot && clientId && adRef.current) {
      try {
        // 如果 window.adsbygoogle 不存在，加载脚本
        if (!(window as any).adsbygoogle) {
          const script = document.createElement('script');
          script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + clientId;
          script.async = true;
          script.crossOrigin = 'anonymous';
          document.head.appendChild(script);
        }

        // 推送广告
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (err) {
        console.warn('AdSense 加载失败:', err);
      }
    }
  }, [type, slot, clientId]);

  // AdSense 模式
  if (type === 'adsense' && slot) {
    return (
      <div ref={adRef} className="w-full">
        <ins
          className="adsbygoogle"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
          }}
          data-ad-client={clientId}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // 占位符模式（默认）
  return (
    <div
      ref={adRef}
      className="w-full h-full flex items-center justify-center bg-gradient-to-r from-white/5 to-white/10 rounded-lg border border-dashed border-white/20"
    >
      <span className="text-xs text-zinc-400/70">{label}</span>
    </div>
  );
}
