import { useEffect, useMemo, useRef, useState } from 'react';

import { nextCandidates, preloadWithTimeout, remember, setIntervalForBg, PICSUM_FALLBACKS } from '@/utils/bg';

type Props = {
  intervalMs?: number;
  darken?: number;
  contrast?: number;
  brightness?: number;
  timeoutMs?: number;
  storageKey?: string;
};

const DEFAULT_PLACEHOLDER = PICSUM_FALLBACKS[0] ?? '';

type GlobalGuard = {
  mainTimer: number | null;
  retryTimer: number | null;
  inFlight: boolean;
  nextSwitchAt: number;
};

declare global {
  interface Window { __BG_ROTATOR__?: GlobalGuard }
}

export default function BackgroundRotator({
  intervalMs = 15000,
  darken = 0.45,
  contrast = 1.05,
  brightness = 0.95,
  timeoutMs = 4000,
  storageKey = 'chatsphere:lastBg',
}: Props) {

  const initial = useMemo<string>(() => {
    try { return localStorage.getItem(storageKey) || DEFAULT_PLACEHOLDER; }
    catch { return DEFAULT_PLACEHOLDER; }
  }, [storageKey]);

  const [url, setUrl] = useState<string>(initial);

  // 全局守护对象（只在初始化时创建一次）
  const guardRef = useRef<GlobalGuard>();
  if (!guardRef.current) {
    if (!window.__BG_ROTATOR__) {
      window.__BG_ROTATOR__ = { mainTimer: null, retryTimer: null, inFlight: false, nextSwitchAt: Date.now() };
    } else {
      const g = window.__BG_ROTATOR__;
      if (g?.mainTimer) { clearTimeout(g.mainTimer); g.mainTimer = null; }
      if (g?.retryTimer) { clearTimeout(g.retryTimer); g.retryTimer = null; }
      g.inFlight = false;
    }
    guardRef.current = window.__BG_ROTATOR__!;
  }

  // 参数 ref（用于异步回调中访问最新值）
  const paramsRef = useRef({ intervalMs, timeoutMs, storageKey });
  paramsRef.current = { intervalMs, timeoutMs, storageKey };

  // tick 函数：纯粹的异步逻辑，不产生新的状态对象
  const tick = async () => {
    const guard = guardRef.current!;
    const now = Date.now();

    // 节拍未到，等待
    if (now < guard.nextSwitchAt) {
      const waitMs = guard.nextSwitchAt - now;
      schedule(waitMs);
      return;
    }

    // 正在预加载，避免并发
    if (guard.inFlight) {
      schedule(250);
      return;
    }

    guard.inFlight = true;

    // 预加载
    const candidates = nextCandidates();
    let next: string | null = null;
    try {
      next = await Promise.race(candidates.map(u => preloadWithTimeout(u, paramsRef.current.timeoutMs)));
    } catch {
      next = null;
    }

    guard.inFlight = false;

    if (next) {
      // 应用新图（这会触发 setUrl，导致组件重渲）
      setUrl(prev => (prev === next ? prev : next));
      remember(next);
      guard.nextSwitchAt = Date.now() + paramsRef.current.intervalMs;
      try { localStorage.setItem(paramsRef.current.storageKey, next); } catch {}

      // 立即安排下一个（不等待重渲完成）
      schedule(paramsRef.current.intervalMs);
    } else {
      // 失败重试
      if (guard.retryTimer) clearTimeout(guard.retryTimer);
      guard.retryTimer = window.setTimeout(() => schedule(0), 3000);
    }
  };

  // schedule 函数：清理旧计时器，设置新计时器
  const schedule = (delay: number) => {
    const guard = guardRef.current!;

    if (guard.mainTimer) clearTimeout(guard.mainTimer);
    guard.mainTimer = window.setTimeout(tick, delay);
  };

  // useEffect：只在首次挂载和 intervalMs 变化时运行
  useEffect(() => {
    const guard = guardRef.current!;
    const now = Date.now();

    console.log(`[BGR] useEffect: setup, now=${now}, nextSwitchAt=${guard.nextSwitchAt}`);

    // ★ 同步去重窗口与轮换间隔
    setIntervalForBg(intervalMs);

    // 对齐节拍
    if (now >= guard.nextSwitchAt) {
      guard.nextSwitchAt = now + intervalMs;
    }

    const initialDelay = Math.max(0, guard.nextSwitchAt - now);
    console.log(`[BGR] useEffect: scheduling in ${initialDelay}ms`);
    schedule(initialDelay);

    // 页面可见性处理
    const onVisibility = () => {
      if (!document.hidden) {
        const t = Math.max(0, guard.nextSwitchAt - Date.now());
        console.log(`[BGR] visibility: visible, rescheduling in ${t}ms`);
        schedule(t);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      console.log(`[BGR] useEffect: cleanup`);
      document.removeEventListener('visibilitychange', onVisibility);
    };

    // 只依赖 intervalMs，其他都用 ref 访问
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        backgroundImage: `linear-gradient(rgba(0,0,0,${darken}), rgba(0,0,0,${darken})), url("${url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        transition: 'background-image 800ms ease-in-out',
        filter: `grayscale(100%) contrast(${contrast}) brightness(${brightness})`,
        pointerEvents: 'none',
        backgroundColor: '#111',
      }}
    />
  );
}
