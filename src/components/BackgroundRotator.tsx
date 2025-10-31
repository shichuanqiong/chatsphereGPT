import { useEffect, useMemo, useRef, useState } from 'react';
import { nextCandidates, preloadWithTimeout, LOCAL_FALLBACKS, markRecent } from '@/utils/bg';

type Props = {
  intervalMs?: number;        // 轮换间隔
  darken?: number;            // 0~1
  contrast?: number;
  brightness?: number;
  timeoutMs?: number;         // 预加载超时
  storageKey?: string;        // 记住上一张
};

const DEFAULT_PLACEHOLDER = LOCAL_FALLBACKS[0] ?? '';

export default function BackgroundRotator({
  intervalMs = 25000,
  darken = 0.45,
  contrast = 1.05,
  brightness = 0.95,
  timeoutMs = 4000,
  storageKey = 'chatsphere:lastBg',
}: Props) {
  // ★ 首屏立即有图：同步读取 localStorage 上一次的图 → 否则用本地占位
  const initial = useMemo<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved || DEFAULT_PLACEHOLDER;
    } catch {
      return DEFAULT_PLACEHOLDER;
    }
  }, [storageKey]);

  const [url, setUrl] = useState<string>(initial);
  const timer = useRef<number | null>(null);
  const retryBackoff = useRef(1500); // 失败重试退避

  // 把背景设置为某张图（并记录为最近 & 持久化）
  const apply = (next: string) => {
    if (!next) return;             // 永远不设空 URL
    setUrl(next);
    markRecent(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {}
  };

  // 竞速加载：并发尝试在线候选，超时或全失败则回退本地
  const loadNext = async () => {
    const candidates = nextCandidates();
    try {
      const winner = await Promise.race(
        candidates.map(u => preloadWithTimeout(u, timeoutMs))
      );
      apply(winner);
      retryBackoff.current = 1500; // 成功后重置退避
    } catch {
      // 所有候选在 timeout 内都失败 → 直接回退到本地图（轮询本地数组避免长时间同一张）
      const idx = Math.floor(Math.random() * LOCAL_FALLBACKS.length);
      apply(LOCAL_FALLBACKS[idx] || DEFAULT_PLACEHOLDER);

      // 安排一次退避重试，避免卡死在本地图
      const wait = Math.min(retryBackoff.current, 10000);
      retryBackoff.current = wait * 2;
      window.setTimeout(() => {
        void loadNext();
      }, wait);
    }
  };

  useEffect(() => {
    let mounted = true;

    // 挂载后立即尝试准备"更好"的下一张（但首屏已经有图，不会黑屏）
    void loadNext();

    // 固定间隔正常轮换
    timer.current = window.setInterval(() => {
      if (!mounted) return;
      void loadNext();
    }, intervalMs);

    return () => {
      mounted = false;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [intervalMs]);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        // 即便网络慢，也始终有一张 url（localStorage 或本地占位）
        backgroundImage: `linear-gradient(rgba(0,0,0,${darken}), rgba(0,0,0,${darken})), url("${url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        transition: 'background-image 800ms ease-in-out',
        // 强制黑白 + 微调
        filter: `grayscale(100%) contrast(${contrast}) brightness(${brightness})`,
        pointerEvents: 'none',
        // 避免白屏闪烁
        backgroundColor: '#111',
      }}
    />
  );
}
