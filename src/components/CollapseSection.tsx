import { useEffect, useState } from 'react';

export default function CollapseSection({
  id, title, children, defaultOpen = true
}: { id: string; title: string; children: React.ReactNode; defaultOpen?: boolean; }) {
  const key = `cs_collapse_${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    const v = localStorage.getItem(key);
    return v === null ? defaultOpen : v === '1';
  });
  useEffect(() => { localStorage.setItem(key, open ? '1' : '0'); }, [open]);

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

