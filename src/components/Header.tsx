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
        className="sticky top-0 z-40 bg-black/40 backdrop-blur-xl border-b border-white/10 px-3 md:px-6"
        style={{paddingTop:'env(safe-area-inset-top)'}}
      >
        {/* 一行三段：左中右 */}
        <div className="h-16 md:h-20 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* 左：Logo + 品牌 */}
          <div className="min-w-0 flex items-center gap-3">
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

          {/* 中：Top Banner（自适应居中） */}
          <div className="justify-self-center w-full max-w-[728px] px-2">
            <div className="h-[44px] md:h-[56px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,.25)] flex items-center justify-center">
              <span className="text-sm text-zinc-200/90">Ad — Top Banner</span>
              {/* 之后替换为 <ResponsiveAd slot="XXXX" /> */}
            </div>
          </div>

          {/* 右：操作区（靠右对齐） */}
          <div id="rightControls" className="justify-self-end flex items-center gap-2">
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

            {/* 用户名 */}
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
                    className="w-full text-left px-3 py-2 hover:bg-white/10 border-t border-white/10"
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
