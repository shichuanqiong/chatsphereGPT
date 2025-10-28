import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { blockUser, unblockUser, muteUser, unmuteUser } from '../lib/social';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

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
  position?: { x: number; y: number };
};

export function UserActionMenu({ user, isOpen, onClose, position = { x: 0, y: 0 } }: UserActionMenuProps) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(false);

  const myUid = auth.currentUser?.uid;
  const isMyself = user.uid === myUid;

  // 监听用户的屏蔽和静音状态
  useEffect(() => {
    if (!myUid || isMyself) return;

    const blocksRef = ref(db, `blocks/${myUid}/${user.uid}`);
    const mutesRef = ref(db, `mutes/${myUid}/${user.uid}`);

    const offBlocks = onValue(blocksRef, (snap) => {
      setIsBlocked(snap.exists());
    });

    const offMutes = onValue(mutesRef, (snap) => {
      setIsMuted(snap.exists());
    });

    return () => {
      offBlocks();
      offMutes();
    };
  }, [myUid, user.uid, isMyself]);

  const handleBlock = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isBlocked) {
        await unblockUser(user.uid);
      } else {
        await blockUser(user.uid);
      }
    } catch (error) {
      console.error('Error toggling block:', error);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleMute = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isMuted) {
        await unmuteUser(user.uid);
      } else {
        await muteUser(user.uid);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    } finally {
      setLoading(false);
      onClose();
    }
  };

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
          onClick={handleBlock}
          disabled={loading}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
            isBlocked ? 'text-red-400' : 'text-white'
          }`}
        >
          {isBlocked ? '🔓 Unblock' : '🚫 Block'}
        </button>
        
        <button
          onClick={handleMute}
          disabled={loading}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
            isMuted ? 'text-yellow-400' : 'text-white'
          }`}
        >
          {isMuted ? '🔊 Unmute' : '🔇 Mute'}
        </button>
      </div>
    </>
  );
}
