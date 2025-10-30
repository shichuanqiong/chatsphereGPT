import { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
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
  const hoverMenuTimer = useRef<number>();

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
  const topbarRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const updateHeaderVar = () => {
      const el = topbarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      document.documentElement.style.setProperty('--header-h', `${rect.height}px`);
    };
    updateHeaderVar();
    window.addEventListener('resize', updateHeaderVar);
    window.addEventListener('orientationchange', updateHeaderVar);
    return () => {
      window.removeEventListener('resize', updateHeaderVar);
      window.removeEventListener('orientationchange', updateHeaderVar);
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(hoverMenuTimer.current);
    };
  }, []);

  const openMenuHover = () => {
    window.clearTimeout(hoverMenuTimer.current);
    setMenuOpen(true);
  };
  const scheduleCloseMenu = () => {
    window.clearTimeout(hoverMenuTimer.current);
    hoverMenuTimer.current = window.setTimeout(() => setMenuOpen(false), 160);
  };

  return (
    <>
      {/* 顶部条 */}
      <header
        id="topbar"
        ref={topbarRef}
        className="sticky top-0 z-40 h-24 w-full border-b border-white/10 bg-black/50 backdrop-blur flex items-center"
      >
        <div className="max-w-[1400px] mx-auto w-full px-4 grid grid-cols-[auto,1fr,auto] items-center gap-4">
          {/* 左：Logo + 站名 */}
          <div className="flex items-center gap-3">
            <button id="mobile-open-sidebar" aria-label="Open menu">☰</button>
            <div id="midControlsAnchor" className="mid-controls-anchor flex items-center gap-2"></div>
            <div className="header-brand flex items-center gap-3 brand">
              <div className="logo">
                <Logo size={40} />
              </div>
              <div className="title text-[26px] font-semibold tracking-wide bg-clip-text text-transparent
                              bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300">
                ChatSphere
              </div>
            </div>
          </div>

          {/* 中：广告位 */}
          <div id="adTopSlot" className="px-2">
            <div id="adTop" className="h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 text-sm">
              Ad — Top Banner
            </div>
          </div>

          {/* 右：Inbox / 铃铛 / 用户名 / 头像 / Logout */}
          <div id="rightControls" className="flex items-center gap-2">
            <div
              id="btnInbox"
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
                <div
                  className="inbox-popover fixed z-[1000] left-1/2 -translate-x-1/2 mt-2 rounded-2xl shadow-xl bg-zinc-900/95 backdrop-blur text-zinc-100 w-[min(92vw,420px)] max-h-[min(70vh,560px)] overflow-auto p-3 border border-white/10 sm:absolute sm:left-auto sm:right-0 sm:translate-x-0 sm:w-[360px] sm:max-h-[540px]"
                  style={{
                    top: `calc(var(--header-h, 56px) + env(safe-area-inset-top))`,
                    paddingLeft: 'max(12px, env(safe-area-inset-left))',
                    paddingRight: 'max(12px, env(safe-area-inset-right))',
                  }}
                >
                  {inboxContent}
                </div>
              )}
            </div>

            <button
              id="btnBell"
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

            <div
              id="userAvatarWrap"
              className="relative"
              onMouseEnter={openMenuHover}
              onMouseLeave={scheduleCloseMenu}
            >
              <button
                onFocus={openMenuHover}
                onBlur={scheduleCloseMenu}
                className="h-10 w-10 rounded-full border border-white/10 overflow-hidden"
                title="Profile"
              >
                <img src={avatarUrl} className="h-full w-full object-cover" alt="me" />
              </button>
              {menuOpen && (
                <div
                  id="profileMenu"
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-900 border border-white/10 shadow-xl z-50"
                  onMouseEnter={openMenuHover}
                  onMouseLeave={scheduleCloseMenu}
                >
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
      </header>

      <ProfileModal
        open={openProfile}
        onClose={() => setOpenProfile(false)}
        profile={currentProfile as any}
      />
    </>
  );
}
