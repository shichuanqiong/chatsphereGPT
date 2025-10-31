import { useEffect, useRef, useState } from 'react';

/**
 * 极简稳定方案 + 强去重：
 * - 每 20s 直接换一张图（不做预加载/交叉淡入）
 * - 永远有一张 <img> 在屏幕上 → 不会黑屏
 * - 出错时马上切备用图（Picsum 固定 id）
 * - 完全随机关键词（无偏好），16 张去重窗口
 */

const INTERVAL_MS = 20_000;
const WIDTH = 3840;
const HEIGHT = 2160;

// 扩大关键词库：无偏好，全类别随机
const KEYWORDS = [
  // 城市
  'city', 'urban', 'street', 'skyline', 'architecture', 'downtown', 'metro',
  // 自然
  'mountain', 'forest', 'ocean', 'lake', 'desert', 'valley', 'river', 'coast',
  // 天气
  'sunset', 'sunrise', 'rain', 'snow', 'storm', 'sky', 'cloud',
  // 抽象
  'abstract', 'minimal', 'pattern', 'geometry', 'texture',
  // 其他
  'night', 'dark', 'landscape', 'nature', 'travel', 'adventure'
];

// 备用静态图
const FALLBACKS = [
  `https://picsum.photos/id/1011/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1015/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1021/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1036/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1040/${WIDTH}/${HEIGHT}?grayscale`
];

// 追踪最近使用过的查询，避免重复
const recentQueries = new Set<string>();
const MAX_RECENT = 16;

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 超强 cache-buster + 完全随机关键词 + 强去重
function randomOnlineUrl() {
  // 1. 超强 cache-buster：时间戳 + 多个长随机数
  const timestamp = Date.now();
  const random1 = Math.random().toString(36).substring(2, 18);
  const random2 = Math.random().toString(36).substring(2, 18);
  const sig = `${timestamp}-${random1}-${random2}`;
  
  // 2. 随机选择 1-4 个关键词组合（完全随机，无偏好）
  const keywords = [];
  const count = Math.floor(Math.random() * 4) + 1;
  for (let i = 0; i < count; i++) {
    keywords.push(pick(KEYWORDS));
  }
  
  // 3. 去重检查 - 如果重复则重新生成
  let query = keywords.join(',');
  let attempts = 0;
  while (recentQueries.has(query) && attempts < 10) {
    keywords.length = 0;
    for (let i = 0; i < count; i++) {
      keywords.push(pick(KEYWORDS));
    }
    query = keywords.join(',');
    attempts++;
  }
  
  // 记录此次查询
  recentQueries.add(query);
  if (recentQueries.size > MAX_RECENT) {
    const first = recentQueries.values().next().value;
    recentQueries.delete(first);
  }
  
  // 4. 编码关键词 + 加入黑白指令
  const q = encodeURIComponent(`${query}, black and white, monochrome, grayscale`);
  
  // Source Unsplash：简单，稳定，单张直链
  return `https://source.unsplash.com/random/${WIDTH}x${HEIGHT}/?${q}&${sig}&bw`;
}

export default function BackgroundRotator() {
  const [src, setSrc] = useState<string>(randomOnlineUrl());
  const fbIdx = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSrc(randomOnlineUrl());
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const onError = () => {
    // 在线图失败就切换到 FALLBACKS，绝不黑屏
    fbIdx.current = (fbIdx.current + 1) % FALLBACKS.length;
    setSrc(FALLBACKS[fbIdx.current]);
  };

  return (
    <div className="fixed inset-0 -z-10">
      {/* 这里永远有一张图在渲染，失败立即切兜底 → 不会黑屏 */}
      <img
        src={src}
        onError={onError}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{ filter: 'grayscale(100%)' }}
      />
      {/* 统一加一层暗罩，保持前景可读性 */}
      <div className="absolute inset-0 bg-black/45" />
    </div>
  );
}
