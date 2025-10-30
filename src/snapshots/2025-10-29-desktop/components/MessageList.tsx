import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { db } from '../../firebase';
import { onChildAdded, query, ref, limitToLast } from 'firebase/database';

function isImageUrl(s: string) {
  return /^https?:\/\/\S+\.(gif|png|jpg|jpeg|webp)$/i.test(s);
}

export default function MessageList({ path }: { path: string }) {
  const [items, setItems] = useState<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(ref(db, path), limitToLast(200));
    const arr: any[] = [];
    const off = onChildAdded(q, snap => {
      arr.push({ id: snap.key, ...snap.val() });
      setItems([...arr]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 10);
    });
    return () => off();
  }, [path]);

  const formatTime = (timestamp?: number | string) => {
    if (!timestamp) return '';

    const numeric = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
    if (!numeric || Number.isNaN(numeric)) return '';

    const date = dayjs(numeric);
    if (!date.isValid()) return '';

    const now = dayjs();

    if (date.isSame(now, 'day')) {
      return date.format('HH:mm');
    }

    if (date.isSame(now.subtract(1, 'day'), 'day')) {
      return `昨天 ${date.format('HH:mm')}`;
    }

    return date.format('MM/DD HH:mm');
  };

  return (
    <div className='flex-1 overflow-y-auto p-4 space-y-3'>
      {items.map(m => {
        const isSelf = m.authorId === (window as any)._uid;
        const timeLabel = formatTime(m.createdAt);

        return (
          <div key={m.id} className={`max-w-[70%] ${isSelf ? 'ml-auto text-right' : ''}`}>
            <div className={`text-xs text-white/60 mb-1 ${isSelf ? 'text-right' : ''}`}>
              {isSelf ? 'You' : (m.authorNickname || m.authorId)}
            </div>
            {isImageUrl(m.content || '') ? (
              <div className={`inline-flex flex-col gap-1 ${isSelf ? 'items-end' : 'items-start'}`}>
                <div className='relative'>
                  <img src={m.content} alt='gif' className='rounded-xl max-w-[360px]' />
                  {timeLabel && (
                    <span className='absolute bottom-2 right-3 text-[10px] text-white/80 bg-black/40 backdrop-blur px-2 py-0.5 rounded-full'>
                      {timeLabel}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className={`inline-flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2 rounded-2xl ${isSelf ? 'bg-indigo-500/80 text-white' : 'bg-white/10 text-white'} flex flex-col gap-1 max-w-full break-words`}
                >
                  <span className='whitespace-pre-wrap text-sm leading-relaxed'>{m.content}</span>
                  {timeLabel && (
                    <span className={`text-[10px] text-white/70 ${isSelf ? 'self-end' : 'self-start'}`}>
                      {timeLabel}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}


