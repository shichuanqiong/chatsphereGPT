import { useEffect, useLayoutEffect, useRef, MutableRefObject } from 'react';

type Opts = {
  smooth?: boolean;
  bottomThreshold?: number;
  forceOnSelfMessage?: boolean;
  inputSelector?: string;
};

export function useStickToBottom(
  scrollRef: MutableRefObject<HTMLElement | null>,
  deps: any[],
  opts: Opts = {}
) {
  const {
    smooth = false,
    bottomThreshold = 80,
    forceOnSelfMessage = true,
    inputSelector,
  } = opts;

  const atBottomRef = useRef(true);
  const lastLenRef   = useRef(0);
  const selfSentRef  = useRef(false);

  const scrollToBottom = (instant = !smooth) => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (instant) {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    });
  };

  const markSelfSent = () => { selfSentRef.current = true; };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      atBottomRef.current = dist <= bottomThreshold;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef, bottomThreshold]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const len = Array.isArray(deps[0]) ? (deps[0] as any[]).length : deps.length;
    const increased = len > lastLenRef.current;
    lastLenRef.current = len;
    if (!increased) return;
    if (atBottomRef.current || (forceOnSelfMessage && selfSentRef.current)) {
      scrollToBottom(true);
    }
    selfSentRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) scrollToBottom(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  useEffect(() => {
    if (!inputSelector) return;
    const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(inputSelector);
    if (!input) return;
    const onFocus = () => setTimeout(() => scrollToBottom(true), 120);
    input.addEventListener('focus', onFocus);
    return () => input.removeEventListener('focus', onFocus);
  }, [inputSelector]);

  useEffect(() => {
    const vv: VisualViewport | undefined = (window as any).visualViewport;
    if (!vv) return;
    const onResize = () => { if (atBottomRef.current) scrollToBottom(true); };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return { scrollToBottom, markSelfSent };
}


