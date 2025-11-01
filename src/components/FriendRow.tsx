import { auth } from '../firebase';
import { addFriend, removeFriend } from '../lib/friends';
import { useFriends } from '../hooks/useFriends';
import { usePresence } from '../hooks/usePresence';
import { UserActionMenu } from './UserActionMenu';
import { useState, useRef, useEffect } from 'react';

type User = {
  uid: string;
  nickname: string;
  age?: number;
  gender?: string;
  country?: string;
  avatarUrl?: string;
};

export function FriendRow({
  user,
  onOpenDM,
  onOpenProfile,
}: {
  user: User;
  onOpenDM: (user: User) => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const friends = useFriends();
  const isFriend_ = friends.has(user.uid);
  const isOnline = usePresence(user.uid) === 'online';
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const pressTimer = useRef<number | null>(null);
  const pressed = useRef(false);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        window.clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    };
  }, []);
  
  const toggleFriend = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止点 +/− 时触发进入 DM
    if (isFriend_) await removeFriend(user.uid);
    else await addFriend(user.uid);
    // 不需要 setState，useFriends 会推送最新结果，全局同步
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handlePointerCancel();
    if (onOpenProfile) {
      onOpenProfile(user.uid);
    } else {
      setMenuPosition({ x: e.clientX, y: e.clientY });
      setShowMenu(true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pressed.current = false;
    const { clientX, clientY } = e;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);

    pressTimer.current = window.setTimeout(() => {
      pressed.current = true;
      if (onOpenProfile) {
        onOpenProfile(user.uid);
      } else {
        setMenuPosition({ x: clientX, y: clientY });
        setShowMenu(true);
      }
    }, 420);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!pressed.current) {
      const pointerType = e.pointerType;
      const now = Date.now();
      if (pointerType === 'touch' || pointerType === 'pen') {
        const delta = now - lastTapRef.current;
        lastTapRef.current = now;
        if (delta < 350) {
          onOpenDM(user);
        }
      } else {
        onOpenDM(user);
      }
    }
  };

  const handlePointerCancel = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const stopPointer = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const myUid = auth.currentUser?.uid ?? '';
  const isMyself = user.uid === myUid;

  return (
    <>
      <div
        role="button"
        onContextMenu={handleRightClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl hover:bg-white/10 cursor-pointer transition-all shadow-none hover:shadow-[0_8px_24px_rgba(0,0,0,.25)]"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user.avatarUrl || `https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(user.nickname || 'user')}&size=64&radius=50&backgroundType=gradientLinear`}
              className="w-9 h-9 rounded-full object-cover border border-white/10"
              alt=""
            />
            {/* 在线状态点 */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black/50 ${
                isOnline ? 'bg-emerald-400' : 'bg-neutral-500'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
          <div className="leading-tight flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{user.nickname}</div>
            <div className="text-[11px] text-white/60 truncate">
              {user.age ?? '--'} · {user.gender ?? '--'} · {user.country ?? '--'}
            </div>
          </div>
        </div>

        {/* ＋ / − 按钮（仅在 hover 时显示） */}
        {!isMyself && (
          <button
            onClick={toggleFriend}
            onPointerDown={stopPointer}
            onPointerUp={stopPointer}
            onPointerCancel={stopPointer}
            disabled={isMyself}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center text-lg transition-opacity
              opacity-0 group-hover:opacity-100
              ${isFriend_ 
                ? 'border-rose-300 bg-rose-500/30 hover:bg-rose-500/50 text-rose-300' 
                : 'border-emerald-300 bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-300'
              }
              disabled:opacity-30 disabled:cursor-not-allowed`}
            title={isFriend_ ? 'Remove friend' : 'Add friend'}
          >
            {isFriend_ ? '−' : '+'}
          </button>
        )}
      </div>

      <UserActionMenu
        user={user}
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onViewProfile={(userId) => {
          setShowMenu(false);
          onOpenProfile?.(userId);
        }}
        position={menuPosition}
      />
    </>
  );
}

