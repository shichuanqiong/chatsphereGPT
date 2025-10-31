import { useEffect, useMemo, useRef, useState } from 'react';
import { nextCandidates, preloadWithTimeout, markRecent, PICSUM_FALLBACKS } from '@/utils/bg';

type Props = {
  intervalMs?: number;
  darken?: number;
  contrast?: number;
  brightness?: number;
  timeoutMs?: number;
  storageKey?: string;
};

const DEFAULT_PLACEHOLDER = PICSUM_FALLBACKS[0];

export default function BackgroundRotator({
  intervalMs = 25000,
  darken = 0.45,
  contrast = 1.05,
  brightness = 0.95,
  timeoutMs = 4000,
  storageKey = 'chatsphere:lastBg',
}: Props) {
  // ★ 第一层：初值不空（首屏即有图）
  const initial = useMemo<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved || DEFAULT_PLACEHOLDER;
    } catch {
      return DEFAULT_PLACEHOLDER;
    }
  }, [storageKey]);

  const [src, setSrc] = useState<string>(initial);
  const fbIdx = useRef(0);
  const timer = useRef<number | null>(null);

  // ★ 第二层：onError 立即切 Picsum（v1.08 核心）
  const onError = () => {
    fbIdx.current = (fbIdx.current + 1) % PICSUM_FALLBACKS.length;
    setSrc(PICSUM_FALLBACKS[fbIdx.current]);
  };

  const apply = (next: string) => {
    if (!next) return;
    setSrc(next);
    markRecent(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {}
  };

  // 后台预加载下一张（非阻塞）
  const loadNext = async () => {
    const candidates = nextCandidates();
    try {
      const winner = await Promise.race(
        candidates.map(u => preloadWithTimeout(u, timeoutMs))
      );
      apply(winner);
    } catch {
      // ★ 全失败也要有后备：切换到 Picsum 固定 ID
      // 这样保证图片始终在更新，即使网络差
      fbIdx.current = (fbIdx.current + 1) % PICSUM_FALLBACKS.length;
      apply(PICSUM_FALLBACKS[fbIdx.current]);
    }
  };

  useEffect(() => {
    let mounted = true;

    // 后台加载（非阻塞）
    void loadNext();

    // 25s 轮换
    timer.current = window.setInterval(() => {
      if (!mounted) return;
      void loadNext();
    }, intervalMs);

    return () => {
      mounted = false;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [intervalMs, timeoutMs, loadNext]);

  return (
    <div className="fixed inset-0 -z-10">
      {/* ★ 用 img 标签 + onError，实现 v1.08 三层防护 */}
      <img
        src={src}
        onError={onError}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{ filter: `grayscale(100%) contrast(${contrast}) brightness(${brightness})` }}
      />
      {/* ★ 第四层：背景色兜底 */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${darken})` }}
      />
    </div>
  );
}
