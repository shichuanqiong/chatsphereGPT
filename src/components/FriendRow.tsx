import { auth } from '../firebase';
import { addFriend, removeFriend } from '../lib/friends';
import { useFriends } from '../hooks/useFriends';
import { usePresence } from '../hooks/usePresence';
import { UserActionMenu } from './UserActionMenu';
import { useState } from 'react';

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
  onClick,
}: {
  user: User;
  onClick: () => void;
}) {
  const friends = useFriends();
  const isFriend_ = friends.has(user.uid);
  const isOnline = usePresence(user.uid) === 'online';
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  
  const toggleFriend = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止点 +/− 时触发进入 DM
    if (isFriend_) await removeFriend(user.uid);
    else await addFriend(user.uid);
    // 不需要 setState，useFriends 会推送最新结果，全局同步
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const myUid = auth.currentUser?.uid ?? '';
  const isMyself = user.uid === myUid;

  return (
    <>
      <div
        role="button"
        onClick={onClick}
        onContextMenu={handleRightClick}
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
          <div className="leading-tight">
            <div className="font-medium text-sm">{user.nickname}</div>
            <div className="text-[11px] text-white/60">
              {user.age ?? '--'} · {user.gender ?? '--'} · {user.country ?? '--'}
            </div>
          </div>
        </div>

        {/* ＋ / − 按钮（仅在 hover 时显示） */}
        {!isMyself && (
          <button
            onClick={toggleFriend}
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
        position={menuPosition}
      />
    </>
  );
}

