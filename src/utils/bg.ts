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

// Unsplash query 组合（预定义，不用 seed 参数）
const UNSPLASH_QUERIES = [
  'city,black,white,monochrome,grayscale',
  'mountain,landscape,black,white,monochrome',
  'forest,nature,black,white,grayscale',
  'ocean,sea,black,white,monochrome',
  'street,urban,black,white,grayscale',
  'architecture,building,black,white,monochrome',
  'night,dark,black,white,grayscale',
  'abstract,minimal,black,white,monochrome',
  'river,water,black,white,grayscale',
  'sky,cloud,black,white,monochrome',
  'sunset,sunrise,black,white,grayscale',
  'desert,sand,black,white,monochrome',
  'valley,landscape,black,white,grayscale',
  'coast,beach,black,white,monochrome',
  'aerial,landscape,black,white,grayscale',
  'snow,winter,black,white,monochrome',
];

// Picsum 固定 ID（20 张黑白图，扩大备用库）
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
  'https://picsum.photos/id/1100/1920/1080?grayscale',
  'https://picsum.photos/id/1101/1920/1080?grayscale',
  'https://picsum.photos/id/1102/1920/1080?grayscale',
  'https://picsum.photos/id/1103/1920/1080?grayscale',
  'https://picsum.photos/id/1104/1920/1080?grayscale',
  'https://picsum.photos/id/1105/1920/1080?grayscale',
  'https://picsum.photos/id/1106/1920/1080?grayscale',
  'https://picsum.photos/id/1107/1920/1080?grayscale',
];

const recent = new Set<string>();
const MAX_RECENT = 32;  // 增加去重窗口以支持更多候选

let queryIndex = 0;  // 轮流使用不同的 Unsplash query

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// Unsplash 用预定义的 query（不用 seed，避免 302 重定向）
function makeUnsplash(): string {
  const query = UNSPLASH_QUERIES[queryIndex % UNSPLASH_QUERIES.length];
  queryIndex++;
  const q = encodeURIComponent(query);
  return `https://source.unsplash.com/random/1920x1080/?${q}`;
}

// Picsum 直接用固定 ID
function makePicsum(): string {
  return pick(PICSUM_FALLBACKS);
}

export function nextCandidates(n = 2): string[] {
  // 混合生成：60% Unsplash，40% Picsum 备用
  const candidates: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (Math.random() < 0.6) {
      candidates.push(makeUnsplash());
    } else {
      candidates.push(makePicsum());
    }
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
      if (Math.random() < 0.6) {
        newCandidates.push(makeUnsplash());
      } else {
        newCandidates.push(makePicsum());
      }
    }
    const freshOnes = Array.from(new Set(newCandidates)).filter(u => !recent.has(u));
    
    if (freshOnes.length > 0) {
      return freshOnes.slice(0, n);
    }
  }
  
  // 极端情况：清空 recent 重新开始
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
