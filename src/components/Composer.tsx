// src/components/Composer.tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ref as dbRef, push, serverTimestamp, runTransaction, set, update, get } from 'firebase/database';
import { auth, db } from '../firebase';
import { useToast } from './Toast';
import { canSendTo } from '../lib/social';
import { 
  checkRateLimit, 
  recordMessage, 
  getSlowModeFromSettings,
  checkRateLimitCrossTabs,
  recordMessageCrossTabs
} from '../utils/rateLimiter';

type Target = { roomId?: string; dmId?: string };

export type ComposerRef = {
  focus: () => void;
};

type ComposerProps = {
  target: Target;
  onSelfSend?: () => void;
};

const EmojiPickerMobileSheet = ({ emojis, onSelect, onClose }: { emojis: string[]; onSelect: (emoji: string) => void; onClose: () => void }) => {
  return (
    <div
      className="fixed inset-0 z-[1100] sm:hidden bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[max(12px,env(safe-area-inset-bottom))] w-[min(96vw,520px)] h-[min(45vh,420px)] rounded-2xl shadow-xl bg-zinc-900 text-zinc-100 overflow-auto p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-8 gap-2">
          {emojis.map((e) => (
            <button
              key={e}
              onClick={() => onSelect(e)}
              className="h-10 w-10 text-xl rounded-lg bg-white/5 hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Composer = forwardRef<ComposerRef, ComposerProps>(function Composer({ target, onSelfSend }, ref) {
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

  // 获取 Slow Mode 设置
  const getSlowMode = () => {
    try {
      const settings = localStorage.getItem('system-settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        console.log('[Composer] Loaded slow mode from localStorage:', parsed.slowMode);
        return parsed.slowMode || 0;
      }
    } catch (error) {
      console.error('Failed to get slow mode:', error);
    }
    console.log('[Composer] No slow mode setting found, using default: 0');
    return 0;
  };

  const sendRecord = async (content: string) => {
    const uid = getUid();
    if (!uid) { show('Session expired. Please re-login.', 'warning'); return; }
    const nickname = getNick();

    // 只在 Room 中应用速率限制，DM 不受影响
    if (target.roomId) {
      const slowModeSeconds = getSlowMode();
      console.log('[Composer] sendRecord: slowModeSeconds =', slowModeSeconds, 'roomId =', target.roomId);
      
      // 1) 检查本地速率限制（包括基础 slow mode 和 spam mode）
      const rateLimitCheck = checkRateLimit(uid, target.roomId, slowModeSeconds);
      console.log('[Composer] Rate limit check result:', rateLimitCheck);
      if (!rateLimitCheck.canSend) {
        show(rateLimitCheck.reason || 'Cannot send message', 'warning');
        return;
      }
      
      // 2) 检查跨标签页/设备的速率限制（可选，从 RTDB 读取）
      const crossTabCheck = await checkRateLimitCrossTabs(uid, target.roomId, slowModeSeconds);
      if (!crossTabCheck.canSend) {
        show(crossTabCheck.reason || 'Rate limited', 'warning');
        return;
      }
      
      // 3) 检查 spam 行为（3 秒内发 3 条自动进入 30 秒防护）
      const spamCheck = recordMessage(uid, target.roomId);
      if (spamCheck.triggered) {
        show(spamCheck.reason || 'Too many messages', 'error');
        return;
      }
    }

    const isGifUrl = /^https?:\/\/.+\.(gif)$/i.test(content.trim()) || /\/gif/i.test(content);
    const payload: any = {
      authorId: uid,
      authorName: nickname,
      type: isGifUrl ? 'gif' : 'text',
      content: content.trim(),
      createdAt: serverTimestamp(),
    };

    if (target.roomId) {
      await push(dbRef(db, `/messages/${target.roomId}`), payload);
      // 记录到 RTDB，确保跨标签页一致性
      await recordMessageCrossTabs(uid, target.roomId);
    } else if (target.dmId) {
      // 检查是否被屏蔽
      const [a, b] = target.dmId.split('__');
      const peerUid = uid === a ? b : a;
      if (!(await canSendTo(peerUid))) { show('Messaging is blocked with this user.', 'error'); return; }
      
      console.log('[DM DEBUG] 开始发送消息', { dmId: target.dmId, uid, peerUid });
      
      const me = uid;
      const peer = me === a ? b : a;

      // 只做最必要的操作：写消息 + 保存 thread
      try {
        // 1) 直接写消息（简化）
        const msgRef = await push(dbRef(db, `/dmMessages/${target.dmId}`), payload);
        console.log('[DM DEBUG] ✅ 消息写入成功', { msgKey: msgRef.key });
        
        // 2) 后台更新 thread（不阻塞）
        Promise.all([
          // 发送者 thread
          set(dbRef(db, `/dmThreads/${me}/${target.dmId}`), {
            threadId: target.dmId,
            peerId: peer,
            lastMsg: short(payload.type === 'gif' ? '[GIF]' : payload.content),
            lastSender: me,
            lastTs: serverTimestamp(),
            unread: 0
          }).catch(err => console.error('[DM DEBUG] 发送者 thread 失败:', err)),
          
          // 接收者 thread
          get(dbRef(db, `/dmThreads/${peer}/${target.dmId}`)).then(snap => {
            const curUnread = snap.exists() ? (snap.val()?.unread || 0) : 0;
            return set(dbRef(db, `/dmThreads/${peer}/${target.dmId}`), {
              threadId: target.dmId,
              peerId: me,
              lastMsg: short(payload.type === 'gif' ? '[GIF]' : payload.content),
              lastSender: me,
              lastTs: serverTimestamp(),
              unread: curUnread + 1
            });
          }).catch(err => console.error('[DM DEBUG] 接收者 thread 失败:', err))
        ]).catch(() => {});
        
        // 3) 后台更新 inbox（不阻塞）
        const inboxKey = `dm_${target.dmId}`;
        set(dbRef(db, `/inbox/${peer}/${inboxKey}`), {
          type: 'dm',
          threadId: target.dmId,
          peerId: me,
          peerName: nickname,
          lastMsg: short(payload.type === 'gif' ? '[GIF]' : payload.content),
          lastTs: serverTimestamp()
        }).catch(err => console.error('[DM DEBUG] inbox 失败:', err));
        
      } catch (err) {
        console.error('[DM DEBUG] ❌ 消息写入失败:', err);
        show('Failed to send message', 'error');
        return;
      }
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

  const emojis = [
    '😀','😁','😂','🤣','😊','🙂','😉','😍','😘','😜','🤗','🤭','🤫','😴','🤤','🤔','🤨','😎','🥳','🤩','😇',
    '😢','😭','😡','🤬','😱','😳','😐','😶','🙃','😏','😌','🤝','👍','👎','👏','🙌','🙏','💪','🫶','💯','🔥','✨','🌟',
    '🎉','🎊','🎈','🎵','🎧','🎬','🍔','🍟','🍕','🌮','🍣','🍺','☕','🍵','⚽','🏀','🏈','🎮','🕹️','💡','📸','📱','💎'
  ];
  const pick = async (e: string) => { await sendRecord(e); };

  useEffect(() => { inputRef.current?.focus(); }, [target?.roomId, target?.dmId]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = inputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      setTimeout(() => el.focus({ preventScroll: true }), 30);
      setTimeout(() => el.focus({ preventScroll: true }), 120);
    },
  }), []);

  return (
    <div className="w-full border-t border-white/10 bg-black/60">
      <div className="max-w-[1100px] mx-auto flex items-end gap-2 p-3">
        <textarea id="chat-input"
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
          <button
            onClick={onEmojiTriggerClick}
            className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-xl"
            aria-label="Emoji"
          >🙂</button>

          {openEmoji && (
            isTouch ? (
              <EmojiPickerMobileSheet
                emojis={emojis}
                onSelect={(emoji) => pick(emoji)}
                onClose={() => setOpenEmoji(false)}
              />
            ) : (
              <div
                onMouseEnter={onEmojiBoxEnter}
                onMouseLeave={onEmojiBoxLeave}
                className="absolute bottom-12 right-0 z-50 w-[320px] max-h-[260px] overflow-auto
                           grid grid-cols-8 gap-1 p-2 rounded-2xl bg-zinc-800/95 border border-white/10 shadow-xl"
              >
                {emojis.map((e) => (
                  <button key={e} onClick={() => pick(e)} className="h-8 w-8 text-lg hover:bg-white/10 rounded">
                    {e}
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        <button
          onClick={() => { if (text.trim()) { onSelfSend?.(); sendRecord(text); setText(''); } }}
          className="h-10 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-500
                     transition-all duration-200 hover:from-teal-300 hover:to-indigo-400 hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
        >Send</button>
      </div>
    </div>
  );
});

export default Composer;
