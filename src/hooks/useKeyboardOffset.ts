import { useEffect } from "react";

export function useKeyboardOffset() {
  useEffect(() => {
    const vv = (window as any).visualViewport;
    if (!vv) return;

    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb-offset", `${offset}px`);
    };

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();

    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);
}
