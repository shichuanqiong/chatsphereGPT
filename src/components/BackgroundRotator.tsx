import { useEffect, useRef, useState } from 'react';
import { nextBgUrl, preload } from '@/utils/bg';

type Props = {
  /** 轮换间隔（毫秒） */
  intervalMs?: number;
  /** 暗化程度 0~1 */
  darken?: number;
  /** 额外对比/亮度微调（可选） */
  contrast?: number; // e.g. 1.05
  brightness?: number; // e.g. 0.95
};

export default function BackgroundRotator({
  intervalMs = 15000,
  darken = 0.45,
  contrast = 1.05,
  brightness = 0.95,
}: Props) {
  const timer = useRef<number | null>(null);
  const [url, setUrl] = useState<string>('');
  const nextUrlRef = useRef<string>('');

  useEffect(() => {
    let mounted = true;

    const swap = () => {
      // ★ 立即显示下一张（如果已预加载）或生成新的
      const displayUrl = nextUrlRef.current || nextBgUrl();
      if (mounted) setUrl(displayUrl);

      // ★ 后台异步预加载再下一张（不 await，不阻塞）
      const futureUrl = nextBgUrl();
      preload(futureUrl).catch(() => {
        // 预加载失败也不影响，下次切换时会重试
      });
      nextUrlRef.current = futureUrl;
    };

    // ★ 挂载时立即执行一次（秒速显示第一张）
    swap();

    // ★ 每 15 秒切换一次
    timer.current = window.setInterval(swap, intervalMs);

    return () => {
      mounted = false;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [intervalMs]);

  // 用一个独立的全屏图层渲染背景，不影响前景文本颜色
  // pointer-events: none; 保证你能正常点击页面

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        backgroundImage: url
          ? `linear-gradient(rgba(0,0,0,${darken}), rgba(0,0,0,${darken})), url("${url}")`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        transition: 'background-image 800ms ease-in-out',
        // ★ 绝对黑白：只给背景层加滤镜，前景不受影响
        filter: `grayscale(100%) contrast(${contrast}) brightness(${brightness})`,
        pointerEvents: 'none',
      }}
    />
  );
}
