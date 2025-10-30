import { auth } from '../firebase';

type User = {
  uid: string;
  nickname: string;
  age?: number;
  gender?: string;
  country?: string;
  avatarUrl?: string;
};

type UserActionMenuProps = {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
  position?: { x: number; y: number };
};

export function UserActionMenu({ user, isOpen, onClose, onViewProfile, position = { x: 0, y: 0 } }: UserActionMenuProps) {
  const isMyself = user.uid === auth.currentUser?.uid;

  if (!isOpen || isMyself) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* 菜单 */}
      <div
        className="fixed z-50 bg-zinc-900/95 backdrop-blur border border-white/10 rounded-xl shadow-xl py-2 min-w-[180px]"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        <div className="px-3 py-2 text-xs text-white/60 border-b border-white/10 mb-2">
          {user.nickname}
        </div>

        <button
          onClick={() => {
            onClose();
            onViewProfile(user.uid);
          }}
          className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors text-white"
        >
          查看资料
        </button>
      </div>
    </>
  );
}
