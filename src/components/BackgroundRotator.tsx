import { useEffect, useRef, useState } from 'react';

/**
 * 极简稳定方案：
 * - 每 20s 直接换一张图（不做预加载/交叉淡入）
 * - 永远有一张 <img> 在屏幕上 → 不会黑屏
 * - 出错时马上切备用图（本地或 picsum 固定 id）
 * - 添加去重机制，避免短时间内重复
 */

const INTERVAL_MS = 20_000;
const WIDTH = 3840;
const HEIGHT = 2160;

// 60% 城市 / 40% 自然
const CITY = [
  'city', 'urban', 'skyline', 'architecture', 'street',
  'downtown', 'night%20city', 'metro', 'tokyo', 'new%20york',
  'hong%20kong', 'shanghai', 'dubai', 'london'
];
const NATURE = ['mountain', 'coast', 'forest', 'desert', 'valley', 'river', 'lake'];

// 备用静态图
const FALLBACKS = [
  `https://picsum.photos/id/1011/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1015/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1021/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1036/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1040/${WIDTH}/${HEIGHT}?grayscale`
];

// 追踪最近使用过的查询，避免短时间重复
const recentQueries = new Set<string>();
const MAX_RECENT = 8;

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 强力 cache-buster + 去重
function randomOnlineUrl() {
  // 1. 强 cache-buster：时间戳 + 长随机数
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
  const sig = `${timestamp}-${randomPart}`;
  
  // 2. 组合多个关键词增加多样性
  const isCity = Math.random() < 0.6;
  const keywords = [];
  
  // 随机选择 1-3 个关键词组合
  const keywordSet = isCity ? CITY : NATURE;
  const count = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < count; i++) {
    keywords.push(pick(keywordSet));
  }
  
  // 3. 检查是否在最近使用过，避免重复
  let query = keywords.join(',');
  while (recentQueries.has(query) && recentQueries.size > 0) {
    // 如果重复，重新生成
    for (let i = 0; i < count; i++) {
      keywords[i] = pick(keywordSet);
    }
    query = keywords.join(',');
  }
  
  // 记录此次查询
  recentQueries.add(query);
  if (recentQueries.size > MAX_RECENT) {
    const first = recentQueries.values().next().value;
    recentQueries.delete(first);
  }
  
  const q = encodeURIComponent(`${query}, black and white, monochrome`);
  
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
