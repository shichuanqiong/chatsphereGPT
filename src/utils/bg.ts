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

// ★ 时间窗口的去重策略（保证最近 N 分钟内不重复）
export const NO_REPEAT_MINUTES = 45;

const DEFAULT_INTERVAL_MS = 15000;

// 计算应该保存的最大 URL 数量
let maxRecent = Math.ceil((NO_REPEAT_MINUTES * 60 * 1000) / DEFAULT_INTERVAL_MS);

// 最近使用队列（FIFO）+ Set 加速查询
const recent: string[] = [];
const recentSet = new Set<string>();

let queryIndex = 0;  // 轮流使用不同的 Unsplash query

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// ★ 单调递增的 Picsum seed（保证源头不重复）
function nextSeed(): string {
  try {
    const k = 'bgSeedCounter';
    const n = (parseInt(localStorage.getItem(k) || '0', 10) || 0) + 1;
    localStorage.setItem(k, String(n));
    return n.toString(36);  // 更短的 seed
  } catch {
    // localStorage 不可用时退回时间+随机
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
}

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

  console.log(`[BG] remember: added, queue size=${recent.length}/${maxRecent}`);
}

// Unsplash 用预定义的 query（不用 seed，避免 302 重定向）
function makeUnsplash(): string {
  const query = UNSPLASH_QUERIES[queryIndex % UNSPLASH_QUERIES.length];
  queryIndex++;
  const q = encodeURIComponent(query);
  return `https://source.unsplash.com/random/1920x1080/?${q}`;
}

// Picsum 用单调递增的 seed（保证每次都是新图）
function makePicsum(): string {
  const seed = nextSeed();
  return `https://picsum.photos/seed/${seed}/1920/1080?grayscale`;
}

// ★ 生成候选 URL（60% Unsplash + 40% Picsum）
export function nextCandidates(n = 2): string[] {
  const candidates: string[] = [];
  
  // 混合生成：60% Unsplash，40% Picsum 备用
  for (let i = 0; i < 3; i++) {
    if (Math.random() < 0.6) {
      candidates.push(makeUnsplash());
    } else {
      candidates.push(makePicsum());  // 使用单调 seed，保证新图
    }
  }

  // 快速去重（移除重复）
  const uniq = Array.from(new Set(candidates));

  // 如果有候选，直接返回
  if (uniq.length > 0) {
    console.log(`[BG] nextCandidates: returning ${uniq.length} candidates`);
    return uniq.slice(0, n);
  }

  // 极端情况（概率很小）：都是重复
  return [makeUnsplash(), makePicsum()];
}

// ★ 生成一个保证不在 recent 中的 URL（强制新）
export function nextUniqueUrl(maxTry = 8): string {
  for (let i = 0; i < maxTry; i++) {
    const url = nextCandidates()[0];
    if (!seen(url)) {
      console.log(`[BG] nextUniqueUrl: found fresh URL on try ${i + 1}`);
      return url;
    }
  }

  // 实在撞满了：强制用新 seed
  const force = `https://picsum.photos/seed/${nextSeed()}/1920/1080?grayscale`;
  console.log(`[BG] nextUniqueUrl: all tries exhausted, forcing new URL`);
  return force;
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
      // ★ 取最终 URL（已是直链，可能经过重定向）
      const finalUrl = img.src || url;
      resolve(finalUrl);
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
