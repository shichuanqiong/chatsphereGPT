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

// ★ 时间窗口的去重策略（而非固定数量）
export const NO_REPEAT_MINUTES = 45;

const DEFAULT_INTERVAL_MS = 15000;

// 计算应该保存的最大 URL 数量
let maxRecent = Math.ceil((NO_REPEAT_MINUTES * 60 * 1000) / DEFAULT_INTERVAL_MS);

// 最近使用队列（FIFO）+ Set 加速查询
const recent: string[] = [];
const recentSet = new Set<string>();

let queryIndex = 0;  // 轮流使用不同的 Unsplash query

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// ★ 组件在挂载时调用，同步轮换间隔以自动调整去重窗口
export function setIntervalForBg(intervalMs: number) {
  maxRecent = Math.ceil((NO_REPEAT_MINUTES * 60 * 1000) / intervalMs);
  console.log(`[BG] setIntervalForBg: intervalMs=${intervalMs}ms, maxRecent=${maxRecent}`);
}

// ★ 检查 URL 是否在最近去重窗口内
export function seen(u: string): boolean {
  return recentSet.has(u);
}

// ★ 记住这个 URL（加入去重队列）
export function remember(u: string) {
  // 如果已在集合中，不重复添加
  if (recentSet.has(u)) return;

  recent.push(u);
  recentSet.add(u);

  // 维持队列大小不超过 maxRecent
  while (recent.length > maxRecent) {
    const oldest = recent.shift()!;
    recentSet.delete(oldest);
  }

  console.log(`[BG] remember: added ${u.substring(0, 50)}..., queue size=${recent.length}/${maxRecent}`);
}

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

  // 过滤掉 seen（去重队列中）的 URL 和重复的 URL
  const uniq = Array.from(new Set(candidates)).filter(u => !seen(u));

  // 如果有未用过的候选，直接返回
  if (uniq.length > 0) {
    console.log(`[BG] nextCandidates: found ${uniq.length} fresh candidates`);
    return uniq.slice(0, n);
  }

  // 如果全在去重队列中，生成新候选直到找到不在队列的
  console.log(`[BG] nextCandidates: all candidates in recent, retrying...`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const newCandidates: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (Math.random() < 0.6) {
        newCandidates.push(makeUnsplash());
      } else {
        newCandidates.push(makePicsum());
      }
    }
    const freshOnes = Array.from(new Set(newCandidates)).filter(u => !seen(u));

    if (freshOnes.length > 0) {
      console.log(`[BG] nextCandidates: retry ${attempt + 1} successful, found ${freshOnes.length}`);
      return freshOnes.slice(0, n);
    }
  }

  // 极端情况：清空去重队列重新开始
  console.log(`[BG] nextCandidates: all retries failed, clearing recent queue`);
  recent.length = 0;
  recentSet.clear();
  return [makeUnsplash(), makePicsum()];
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
