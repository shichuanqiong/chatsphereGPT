import { useEffect, useState } from 'react';

const SIDEBAR_SECTIONS = new Set(['official', 'friends', 'userRooms', 'online']);

export default function CollapseSection({
  id, title, children, defaultOpen = true
}: { id: string; title: string; children: React.ReactNode; defaultOpen?: boolean; }) {
  const prefKey = SIDEBAR_SECTIONS.has(id) ? `cs_sidebar_collapse_${id}` : `cs_collapse_${id}`;
  const defaultState = (SIDEBAR_SECTIONS.has(id) ? false : defaultOpen);
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultState;
    const stored = localStorage.getItem(prefKey);
    if (stored === null) return defaultState;
    if (stored === '1' || stored === '0') return stored === '1';
    return defaultState;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(prefKey, open ? '1' : '0');
  }, [open, prefKey]);

  // 允许外部通过自定义事件控制展开/收起
  useEffect(() => {
    const onSet = (e: any) => {
      const d = e?.detail;
      if (!d || d.id !== id) return;
      if (typeof d.open === 'boolean') {
        setOpen(d.open);
      }
    };
    window.addEventListener('cs:set', onSet as any);
    return () => window.removeEventListener('cs:set', onSet as any);
  }, [id]);

  return (
    <div className="px-3 mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-[12px] uppercase tracking-wide text-white/60 px-1"
      >
        <span>{title}</span>
        <span className="text-white/50">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

