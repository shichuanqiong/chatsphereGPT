import { useMemo, useState, useRef } from 'react';
import ProfileModal from './ProfileModal';
import Logo from './Logo';
import { auth } from '../firebase';
import { useSoundToggle } from '../hooks/useSoundToggle';

export default function Header({
  unreadTotal,
  onToggleInbox,
  currentProfile,
  onLogout,
  inboxContent,
}: {
  unreadTotal: number;
  onToggleInbox: () => void;
  currentProfile?: {
    uid: string; nickname: string; gender: 'male'|'female'; age: number; country: string; bio?: string;
  } | undefined;
  onLogout: () => void;
  inboxContent?: React.ReactNode;
}) {
  const [openProfile, setOpenProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const hoverTimer = useRef<number>();
  const { muted, toggle: toggleSound } = useSoundToggle();

  const openOnHover = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setInboxOpen(true), 120);
  };

  const closeOnLeave = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setInboxOpen(false), 120);
  };

  const isGuest = auth.currentUser?.isAnonymous;
  const avatarSeed = currentProfile?.nickname || 'guest';
  const avatarUrl = useMemo(
    () => `https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(avatarSeed)}&size=64&radius=50&backgroundType=gradientLinear`,
    [avatarSeed]
  );

  return (
    <>
      {/* 高度加倍：h-24 */}
      <div className="sticky top-0 z-40 h-24 w-full border-b border-white/10 bg-black/50 backdrop-blur flex items-center">
        <div className="max-w-[1400px] mx-auto w-full px-4 grid grid-cols-[auto,1fr,auto] items-center gap-4">
          {/* 左：Logo + 站名 */}
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div className="text-[26px] font-semibold tracking-wide bg-clip-text text-transparent
                            bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300">
              ChatSphere
            </div>
          </div>

          {/* 中：广告位 */}
          <div className="px-2">
            <div className="h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 text-sm">
              Ad — Top Banner
            </div>
          </div>

          {/* 右：Inbox / 铃铛 / 用户名 / 头像 / Logout */}
          <div className="flex items-center gap-2">
            <div
              className="relative"
              onMouseEnter={openOnHover}
              onMouseLeave={closeOnLeave}
            >
              <button
                onClick={onToggleInbox}
                className="h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 text-sm"
              >
                Inbox
                {unreadTotal > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {unreadTotal}
                  </span>
                )}
              </button>

              {/* 悬停时显示 Inbox 内容 */}
              {inboxOpen && inboxContent && (
                <div className="absolute right-0 mt-2 w-[360px] max-h-[400px] overflow-auto rounded-xl bg-zinc-900 border border-white/10 shadow-xl z-50">
                  {inboxContent}
                </div>
              )}
            </div>

            <button
              onClick={toggleSound}
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? '🔕' : '🔔'}
            </button>

            {/* 用户名显示在 Logout 左边 */}
            <div className="mx-1 text-sm text-white/90">
              {currentProfile?.nickname || 'Guest'}
            </div>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="h-10 w-10 rounded-full border border-white/10 overflow-hidden"
                title="Profile"
              >
                <img src={avatarUrl} className="h-full w-full object-cover" alt="me" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-900 border border-white/10 shadow-xl z-50">
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      setOpenProfile(true);
                    }}
                  >
                    {isGuest ? 'View Profile' : 'Edit Profile'}
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ProfileModal
        open={openProfile}
        onClose={() => setOpenProfile(false)}
        profile={currentProfile as any}
      />
    </>
  );
}
