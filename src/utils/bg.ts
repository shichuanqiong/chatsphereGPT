// src/utils/bg.ts

// 扩大关键词库：30+ 个，无偏好
const TOPICS = [
  // 城市（7个）
  'city', 'urban', 'street', 'skyline', 'architecture', 'downtown', 'metro',
  // 自然（8个）
  'mountain', 'forest', 'ocean', 'lake', 'desert', 'valley', 'river', 'coast',
  // 天气（7个）
  'sunset', 'sunrise', 'rain', 'snow', 'storm', 'sky', 'cloud',
  // 抽象（5个）
  'abstract', 'minimal', 'pattern', 'geometry', 'texture',
  // 其他（5个）
  'night', 'dark', 'landscape', 'nature', 'travel'
];

// v1.08 三层防护：Picsum 固定 ID（永不 404）
export const PICSUM_FALLBACKS = [
  'https://picsum.photos/id/1011/1920/1080?grayscale',
  'https://picsum.photos/id/1015/1920/1080?grayscale',
  'https://picsum.photos/id/1021/1920/1080?grayscale',
  'https://picsum.photos/id/1036/1920/1080?grayscale',
  'https://picsum.photos/id/1040/1920/1080?grayscale',
];

const recent = new Set<string>();
const MAX_RECENT = 16;

// 强化 cache-buster：时间戳 + 两个长随机数
const cb = () => {
  const r1 = Math.random().toString(36).substring(2, 18);
  const r2 = Math.random().toString(36).substring(2, 18);
  return `${Date.now()}-${r1}-${r2}`;
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function makeUnsplash(): string {
  const topic = encodeURIComponent(`${pick(TOPICS)}, black and white, monochrome, grayscale`);
  return `https://source.unsplash.com/random/1920x1080/?${topic}&${cb()}`;
}

function makePicsum(): string {
  return `https://picsum.photos/seed/${cb()}/1920/1080?grayscale`;
}

export function nextCandidates(n = 2): string[] {
  const candidates = [makeUnsplash(), makePicsum()];
  const uniq = Array.from(new Set(candidates)).filter(u => !recent.has(u));
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
      img.src = '';
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
