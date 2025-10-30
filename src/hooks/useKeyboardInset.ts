import { useEffect, useState } from 'react';

/** Tracks current soft keyboard inset (px) and writes CSS variable `--kb`. */
export function useKeyboardInset() {
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;

    const calc = () => {
      const inset = Math.max(0, window.innerHeight - (vv.height + (vv.offsetTop || 0)));
      const bottomInset = Math.max(0, (vv.offsetTop || 0) + vv.height - window.innerHeight);
      setKb(inset);
      document.documentElement.style.setProperty('--kb', `${inset}px`);
      document.documentElement.style.setProperty('--kb-bottom', `${bottomInset}px`);
    };

    calc();
    vv.addEventListener('resize', calc);
    vv.addEventListener('scroll', calc);
    window.addEventListener('orientationchange', calc);

    return () => {
      vv.removeEventListener('resize', calc);
      vv.removeEventListener('scroll', calc);
      window.removeEventListener('orientationchange', calc);
    };
  }, []);

  return kb;
}

