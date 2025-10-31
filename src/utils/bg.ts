// src/utils/bg.ts

const TOPICS = [
  'mountain', 'forest', 'city', 'lake', 'desert', 'coast',
  'fog', 'street', 'aerial', 'architecture', 'night', 'river', 'valley'
];

// 本地备用（永不失败）
export const LOCAL_FALLBACKS = [
  '/fallbacks/bw1.svg',
  '/fallbacks/bw2.svg',
  '/fallbacks/bw3.svg',
  '/fallbacks/bw4.svg',
  '/fallbacks/bw5.svg',
  '/fallbacks/bw6.svg',
];

const recent = new Set<string>();
const MAX_RECENT = 8;

const cb = () => `cb=${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function makeUnsplash(): string {
  const topic = encodeURIComponent(`${pick(TOPICS)}, black and white, monochrome, grayscale`);
  // source.unsplash 会 302 到具体图；加 cache-bust
  return `https://source.unsplash.com/random/1920x1080/?${topic}&${cb()}`;
}

function makePicsum(): string {
  return `https://picsum.photos/seed/${cb()}/1920/1080?grayscale`;
}

export function nextCandidates(n = 2): string[] {
  // 组合两个在线源，并尽量避开 recent
  const candidates = [makeUnsplash(), makePicsum()];
  // 去重 + 过滤掉 recent 内的（不严格，失败则回退本地）
  const uniq = Array.from(new Set(candidates)).filter(u => !recent.has(u));
  // 兜底：如果都在 recent，就返回原 candidates
  return uniq.length ? uniq : candidates;
}

export function markRecent(url: string) {
  recent.add(url);
  while (recent.size > MAX_RECENT) recent.delete(recent.values().next().value);
}

// 预加载带超时（默认 4s）
export function preloadWithTimeout(url: string, timeoutMs = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = ''; // 触发取消
      reject(new Error('timeout'));
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve(url);
    };

    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('error'));
    };

    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.src = url;
  });
}
