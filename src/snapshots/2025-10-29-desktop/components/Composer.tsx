// Snapshot of Composer.tsx (desktop stable)
import { useEffect, useRef, useState } from 'react';
import { ref, push, serverTimestamp, runTransaction, set, update, get } from 'firebase/database';
import { auth, db } from '../../firebase';
import { useToast } from '../../components/Toast';
import { canSendTo } from '../../lib/social';

type Target = { roomId?: string; dmId?: string };

export default function Composer({ target }: { target: Target }) {
  const { show } = useToast();
  const [text, setText] = useState('');
  const [openEmoji, setOpenEmoji] = useState(false);
  const hoverTimer = useRef<any>(null);
  const leaveTimer = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const getUid = () =>
    auth.currentUser?.uid ||
    (window as any)?._uid ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('uid') || '' : '');

  const getNick = () =>
    (typeof localStorage !== 'undefined' ? localStorage.getItem('nickname') || '' : '') ||
    auth.currentUser?.displayName ||
    'anonymous';

  const short = (s: string) => (s.length > 80 ? s.slice(0, 77) + '…' : s);

  const sendRecord = async (content: string) => {
    const uid = getUid();
    if (!uid) { show('Session expired. Please re-login.', 'warning'); return; }
    const nickname = getNick();

    const isGifUrl = /^https?:\/\/.+\.(gif)$/i.test(content.trim()) || /\/gif/i.test(content);
    const payload: any = {
      authorId: uid,
      authorName: nickname,
      type: isGifUrl ? 'gif' : 'text',
      content: content.trim(),
      createdAt: serverTimestamp(),
    };

    if (target.roomId) {
      await push(ref(db, `/messages/${target.roomId}`), payload);
    } else if (target.dmId) {
      // 检查是否被屏蔽
      const [a, b] = target.dmId.split('__');
      const peerUid = uid === a ? b : a;
      if (!(await canSendTo(peerUid))) { show('Messaging is blocked with this user.', 'error'); return; }
      // 1) 写入消息
      await push(ref(db, `/dmMessages/${target.dmId}`), payload);

      // 2) 计算双方 uid（复用上面的 a, b）
      const me = uid;
      const peer = me === a ? b : a;

      // 3) 更新"我的 thread 列表"
      await set(ref(db, `/dmThreads/${me}/${target.dmId}`), {
        threadId: target.dmId,
        peerId: peer,
        lastMsg: short(payload.type === 'gif' ? '[GIF]' : payload.content),
        lastSender: me,
        lastTs: serverTimestamp(),
        unread: 0
      });

      // 4) 更新对方 thread 列表（自增未读）
      const peerPath = ref(db, `/dmThreads/${peer}/${target.dmId}`);
      const peerSnap = await get(peerPath);
      const curUnread = peerSnap.exists() ? (peerSnap.val()?.unread || 0) : 0;
      await update(peerPath, {
        threadId: target.dmId,
        peerId: me,
        lastMsg: short(payload.type === 'gif' ? '[GIF]' : payload.content),
        lastSender: me,
        lastTs: serverTimestamp(),
        unread: curUnread + 1
      });

      // 5) inbox 聚合
      const inboxKey = `dm_${target.dmId}`;
      const peerInboxRef = ref(db, `inbox/${peer}/${inboxKey}`);
      const prev = await get(peerInboxRef);
      const prevCount = prev.exists() ? (prev.val()?.count || 0) : 0;
      await set(peerInboxRef, {
        type: 'dm', threadId: target.dmId, peerId: me, fromName: nickname, to: peer,
        lastMsg: short(payload.type === 'gif' ? '[GIF]' : payload.content), lastSender: me,
        unread: true, count: prevCount + 1, ts: serverTimestamp()
      });
    }

    setOpenEmoji(false);
  };

  // Emoji 交互（桌面：hover；移动：点击切换）
  const onEmojiTriggerEnter = () => { if (isTouch) return; window.clearTimeout(leaveTimer.current); hoverTimer.current = window.setTimeout(() => setOpenEmoji(true), 200); };
  const onEmojiTriggerLeave = () => { if (isTouch) return; window.clearTimeout(hoverTimer.current); leaveTimer.current = window.setTimeout(() => setOpenEmoji(false), 250); };
  const onEmojiBoxEnter = () => { if (isTouch) return; window.clearTimeout(leaveTimer.current); };
  const onEmojiBoxLeave = () => { if (isTouch) return; leaveTimer.current = window.setTimeout(() => setOpenEmoji(false), 200); };
  const onEmojiTriggerClick = () => { if (!isTouch) return; setOpenEmoji((v) => !v); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenEmoji(false); };
    const onScroll = () => setOpenEmoji(false);
    window.addEventListener('keydown', onKey);
    const scroller = document.querySelector('[data-chat-scroll="1"]');
    scroller?.addEventListener('scroll', onScroll);
    return () => { window.removeEventListener('keydown', onKey); scroller?.removeEventListener('scroll', onScroll); };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) { sendRecord(text); setText(''); }
    }
  };
  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const paste = e.clipboardData.getData('text');
    if (paste && /^https?:\/\//i.test(paste)) { e.preventDefault(); await sendRecord(paste); setText(''); }
  };

  const emojis = ['😀','😁','😂','🤣','😊','🙂','😉','😍','😘','😜','🤗','🤭','🤫','😴','🤤','🤔','🤨','😎','🥳','🤩','😇','😢','😭','😡','🤬','😱','😳','😐','😶','🙃','😏','😌','🤝','👍','👎','👏','🙌','🙏','💪','🫶','💯','🔥','✨','🌟','🎉','🎊','🎈','🎵','🎧','🎬','🍔','🍟','🍕','🌮','🍣','🍺','☕','🍵','⚽','🏀','🏈','🎮','🕹️','💡','📸','📱','💎'];
  const pick = async (e: string) => { await sendRecord(e); };

  useEffect(() => { inputRef.current?.focus(); }, [target?.roomId, target?.dmId]);

  return (
    <div className="w-full border-t border-white/10 bg-black/60">
      <div className="max-w-[1100px] mx-auto flex items-end gap-2 p-3">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setOpenEmoji(false)}
          placeholder="Type a message or paste an image/GIF url..."
          className="flex-1 resize-none min-h-[42px] max-h-[140px] px-3 py-2 rounded-xl bg-zinc-900/80 text-white border border-white/10 focus:border-white/30 outline-none"
        />

        <div className="relative" onMouseEnter={onEmojiTriggerEnter} onMouseLeave={onEmojiTriggerLeave}>
          <button onClick={onEmojiTriggerClick} className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-xl" aria-label="Emoji">🙂</button>
          {openEmoji && (
            <div onMouseEnter={onEmojiBoxEnter} onMouseLeave={onEmojiBoxLeave} className="absolute bottom-12 right-0 z-50 w-[320px] max-h-[260px] overflow-auto grid grid-cols-8 gap-1 p-2 rounded-2xl bg-zinc-800/95 border border-white/10 shadow-xl">
              {emojis.map((e) => (
                <button key={e} onClick={() => pick(e)} className="h-8 w-8 text-lg hover:bg-white/10 rounded">{e}</button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => { if (text.trim()) { sendRecord(text); setText(''); } }} className="h-10 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-500 transition-all duration-200 hover:from-teal-300 hover:to-indigo-400 hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400/40">Send</button>
      </div>
    </div>
  );
}


