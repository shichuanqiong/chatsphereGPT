import { useEffect } from "react";

const isIOS = () =>
  /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function useIOSKeyboardVar() {
  useEffect(() => {
    if (!isIOS() || !window.visualViewport) return;

    const vv = window.visualViewport;

    const update = () => {
      // 计算键盘占用的高度：窗口高度 - 可视视口高度 - 顶部偏移
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", `${kb}px`);
      document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
}
