import { useEffect, useRef, useState } from "react";

/**
 * 极简稳定方案：
 * - 每 20s 直接换一张图（不做预加载/交叉淡入）
 * - 永远有一张 <img> 在屏幕上 → 不会黑屏
 * - 出错时马上切备用图（本地或 picsum 固定 id）
 */

const INTERVAL_MS = 20_000;
const WIDTH = 3840;
const HEIGHT = 2160;

// 60% 城市 / 40% 自然（想全城市就把 <0.6 改 <1）
const CITY = [
  "city", "urban", "skyline", "architecture", "street",
  "downtown", "night%20city", "metro", "tokyo", "new%20york",
  "hong%20kong", "shanghai", "dubai", "london"
];
const NATURE = ["mountain", "coast", "forest", "desert", "valley", "river", "lake"];

// 备用静态图（优先用本地 public 下文件；没有就用 picsum 固定 id，不会 404）
const FALLBACKS = [
  // 如果有本地资源，先把这几行的注释去掉并放入 /public/bg 目录：
  // "/bg/bg-1.jpg", "/bg/bg-2.jpg", "/bg/bg-3.jpg", "/bg/bg-4.jpg",
  `https://picsum.photos/id/1011/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1015/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1021/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1036/${WIDTH}/${HEIGHT}?grayscale`,
  `https://picsum.photos/id/1040/${WIDTH}/${HEIGHT}?grayscale`
];

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 简单可靠的在线源（强 sig 防缓存）
function randomOnlineUrl() {
  const isCity = Math.random() < 0.6; // 60% 城市
  const q = isCity ? pick(CITY) : pick(NATURE);
  const sig = Math.floor(Math.random() * 1e9);
  // Source Unsplash：简单，稳定，单张直链
  return `https://source.unsplash.com/random/${WIDTH}x${HEIGHT}/?${q}&sig=${sig}&bw`;
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
        style={{ filter: "grayscale(100%)" }}
      />
      {/* 统一加一层暗罩，保持前景可读性 */}
      <div className="absolute inset-0 bg-black/45" />
    </div>
  );
}
