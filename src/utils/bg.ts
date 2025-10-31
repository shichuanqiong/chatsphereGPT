// 黑白主题的随机背景生成 & 预加载

const TOPICS = [
  'mountain', 'forest', 'city', 'lake', 'desert', 'coast',
  'fog', 'street', 'aerial', 'architecture', 'night', 'river', 'valley'
];

const recent = new Set<string>();
const MAX_RECENT = 8;

function cb() {
  return `cb=${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function pick<T>(a: T[]) {
  return a[Math.floor(Math.random() * a.length)];
}

export function nextBgUrl(): string {
  // 强制黑白语义关键词（提高命中率）
  const topic = encodeURIComponent(`${pick(TOPICS)}, black and white, monochrome, grayscale`);

  // Unsplash Source（黑白关键词 + 缓存破坏）
  const unsplash = `https://source.unsplash.com/random/1920x1080/?${topic}&${cb()}`;

  // Picsum（原生灰度参数 + 种子避免复图）
  const picsum = `https://picsum.photos/seed/${cb()}/1920/1080?grayscale`;

  const candidates = Math.random() < 0.6 ? [unsplash, picsum] : [picsum, unsplash];

  let url = candidates.find(u => !recent.has(u)) || candidates[0];

  recent.add(url);

  while (recent.size > MAX_RECENT) recent.delete(recent.values().next().value);

  return url;
}

export function preload(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}
