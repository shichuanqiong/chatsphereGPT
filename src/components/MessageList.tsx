import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { db, auth } from '../firebase';
import { onChildAdded, query, ref, limitToLast, onValue } from 'firebase/database';
import { useToast } from './Toast';

function isImageUrl(s: string) {
  return /^https?:\/\/\S+\.(gif|png|jpg|jpeg|webp)$/i.test(s);
}

export default function MessageList({ path }: { path: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Record<string, boolean>>({});
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { show } = useToast();

  const uid = (window as any)._uid;
  const currentUid = auth.currentUser?.uid;

  // 诊断日志
  useEffect(() => {
    console.log('[MessageList] ★ Component init:', {
      uid,
      currentUid,
      authUser: auth.currentUser?.email,
      path,
    });
  }, []);

  // 加载消息
  useEffect(() => {
    const q = query(ref(db, path), limitToLast(200));
    const arr: any[] = [];
    const off = onChildAdded(q, snap => {
      arr.push({ id: snap.key, ...snap.val() });
      setItems([...arr]);
      // ★ 延迟滚动，确保 DOM 已更新
      setTimeout(() => {
        if (endRef.current) {
          endRef.current.scrollIntoView({ behavior: 'auto' });
        }
      }, 50);
    });
    return () => off();
  }, [path]);

  // ★ 使用 onValue 而不是 onChildAdded 来订阅 blocks 数据（onChildAdded 只获取新增的，不获取已存在的）
  useEffect(() => {
    if (!uid) {
      console.log('[MessageList] ★ No uid, skip loading blocks');
      return;
    }

    console.log('[MessageList] ★ Loading blocks for uid:', uid);

    const blocksRef = ref(db, `blocks/${uid}`);
    const unsubscribe = onValue(
      blocksRef,
      (snap) => {
        const blocksVal = snap.val() || {};
        console.log('[MessageList] ★ Blocks snapshot received:', blocksVal);
        setBlocks(blocksVal);
      },
      (error) => {
        console.error('[MessageList] ★ Error loading blocks:', error);
      }
    );

    return () => unsubscribe();
  }, [uid]);

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

  const handleBlock = async (authorId: string) => {
    console.log('[MessageList] ★ handleBlock clicked, authorId:', authorId);
    console.log('[MessageList] ★ Current uid:', uid);
    console.log('[MessageList] ★ Current auth uid:', currentUid);

    setBlockingId(authorId);
    try {
      const { blockUser } = await import('../lib/social');
      console.log('[MessageList] ★ Calling blockUser...');
      await blockUser(authorId);
      console.log('[MessageList] ★ blockUser succeeded');
      
      // ★ 立即更新本地状态，无需等待 Firebase 推送
      setBlocks(prev => {
        const next = { ...prev, [authorId]: true };
        console.log('[MessageList] ★ Updated blocks state:', next);
        return next;
      });
      
      show('User blocked', 'success', 900);
      
      // ★ Block 后保持滚动在底部
      setTimeout(() => {
        if (endRef.current) {
          endRef.current.scrollIntoView({ behavior: 'auto' });
        }
      }, 100);
    } catch (e: any) {
      console.error('[MessageList] ★ Block failed:', e);
      show('Failed to block user: ' + (e.message || 'Unknown error'), 'error', 900);
    } finally {
      setBlockingId(null);
    }
  };

  const handleUnblock = async (authorId: string) => {
    console.log('[MessageList] ★ handleUnblock clicked, authorId:', authorId);

    setBlockingId(authorId);
    try {
      const { unblockUser } = await import('../lib/social');
      console.log('[MessageList] ★ Calling unblockUser...');
      await unblockUser(authorId);
      console.log('[MessageList] ★ unblockUser succeeded');
      
      // ★ 立即更新本地状态
      setBlocks(prev => {
        const next = { ...prev };
        delete next[authorId];
        console.log('[MessageList] ★ Updated blocks state:', next);
        return next;
      });
      
      show('User unblocked', 'success', 900);
      
      // ★ Unblock 后保持滚动在底部
      setTimeout(() => {
        if (endRef.current) {
          endRef.current.scrollIntoView({ behavior: 'auto' });
        }
      }, 100);
    } catch (e: any) {
      console.error('[MessageList] ★ Unblock failed:', e);
      show('Failed to unblock user: ' + (e.message || 'Unknown error'), 'error', 900);
    } finally {
      setBlockingId(null);
    }
  };

  return (
    <div ref={containerRef} className='flex-1 overflow-y-auto p-4 space-y-3'>
      {items.map(m => {
        const isSelf = m.authorId === uid || m.authorId === currentUid;
        const timeLabel = formatTime(m.createdAt);
        const isBlocked = blocks[m.authorId];
        const isHovered = hoveredId === m.id;

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
              <div 
                className={`inline-flex flex-col gap-2 ${isSelf ? 'items-end' : 'items-start'}`}
                onMouseEnter={() => !isSelf && setHoveredId(m.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
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
                {isHovered && !isSelf && (
                  <button
                    onClick={() => {
                      console.log('[MessageList] ★ Block button clicked, isBlocked:', isBlocked);
                      if (isBlocked) {
                        handleUnblock(m.authorId);
                      } else {
                        handleBlock(m.authorId);
                      }
                    }}
                    disabled={blockingId === m.authorId}
                    className={`text-xs px-2 py-1 rounded ${isBlocked ? 'bg-red-500/30 text-red-300 hover:bg-red-500/40' : 'bg-white/10 text-white hover:bg-white/20'} transition-colors disabled:opacity-50`}
                  >
                    {isBlocked ? '解除屏蔽' : '屏蔽'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
