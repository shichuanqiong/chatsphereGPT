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

// 完全用 Picsum 固定 ID（12 张黑白图，永不 CORS 失败）
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
const MAX_RECENT = 24;  // 增加去重窗口以应对只用 Picsum

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// 直接返回固定 ID 的 Picsum 图片，避免 seed 导致的 302 重定向
function makePicsum(): string {
  return pick(PICSUM_FALLBACKS);
}

export function nextCandidates(n = 2): string[] {
  // 生成 Picsum 固定 ID 候选（不用 seed，直接从 PICSUM_FALLBACKS 中随机选）
  const candidates: string[] = [];
  for (let i = 0; i < 3; i++) {
    candidates.push(makePicsum());
  }
  
  // 过滤掉 recent 中的 URL 和重复的 URL
  const uniq = Array.from(new Set(candidates)).filter(u => !recent.has(u));
  
  // 如果有未用过的候选，直接返回
  if (uniq.length > 0) {
    return uniq.slice(0, n);
  }
  
  // 如果全在 recent 中，生成新候选直到找到不在 recent 的
  for (let attempt = 0; attempt < 5; attempt++) {
    const newCandidates: string[] = [];
    for (let i = 0; i < 3; i++) {
      newCandidates.push(makePicsum());
    }
    const freshOnes = Array.from(new Set(newCandidates)).filter(u => !recent.has(u));
    
    if (freshOnes.length > 0) {
      return freshOnes.slice(0, n);
    }
  }
  
  // 极端情况：清空 recent 重新开始
  recent.clear();
  return [makePicsum(), makePicsum()];
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
