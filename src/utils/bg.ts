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

// 方案 A：增加 Picsum 备用图从 5 张到 12 张（更多多样性）
export const PICSUM_FALLBACKS = [
  'https://picsum.photos/id/1011/1920/1080?grayscale',
  'https://picsum.photos/id/1015/1920/1080?grayscale',
  'https://picsum.photos/id/1021/1920/1080?grayscale',
  'https://picsum.photos/id/1036/1920/1080?grayscale',
  'https://picsum.photos/id/1040/1920/1080?grayscale',
  'https://picsum.photos/id/1043/1920/1080?grayscale',
  'https://picsum.photos/id/1051/1920/1080?grayscale',
  'https://picsum.photos/id/1060/1920/1080?grayscale',
  'https://picsum.photos/id/1070/1920/1080?grayscale',
  'https://picsum.photos/id/1074/1920/1080?grayscale',
  'https://picsum.photos/id/1084/1920/1080?grayscale',
  'https://picsum.photos/id/1088/1920/1080?grayscale',
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

// 方案 B：修复 Unsplash CORS - 优化 URL 格式
function makeUnsplash(): string {
  const topic = encodeURIComponent(`${pick(TOPICS)}, black and white, monochrome, grayscale`);
  // 添加 t 参数作为额外的缓存破坏器，并确保完整的参数
  return `https://source.unsplash.com/random/1920x1080/?${topic}&t=${cb()}`;
}

function makePicsum(): string {
  return `https://picsum.photos/seed/${cb()}/1920/1080?grayscale`;
}

export function nextCandidates(n = 2): string[] {
  const candidates = [makeUnsplash(), makePicsum()];
  
  // 第一次尝试：过滤掉 recent 中的 URL
  const uniq = Array.from(new Set(candidates)).filter(u => !recent.has(u));
  
  // 如果有未用过的候选，直接返回
  if (uniq.length > 0) {
    return uniq;
  }
  
  // 如果全在 recent 中（16 张已用完），生成新候选直到找到不在 recent 的
  // 最多尝试 5 次，避免无限循环
  for (let attempt = 0; attempt < 5; attempt++) {
    const newCandidates = [makeUnsplash(), makePicsum()];
    const freshOnes = Array.from(new Set(newCandidates)).filter(u => !recent.has(u));
    
    if (freshOnes.length > 0) {
      return freshOnes;
    }
  }
  
  // 极端情况：仍未找到新的，清空 recent 重新开始
  // 这保证了最坏情况下也会返回新的候选
  recent.clear();
  return [makeUnsplash(), makePicsum()];
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
