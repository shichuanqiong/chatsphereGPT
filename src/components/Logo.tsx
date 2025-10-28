export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      className="drop-shadow-[0_6px_24px_rgba(0,0,0,.25)]"
    >
      <defs>
        <linearGradient id="cs-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="60%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* 背景块（圆角方块） */}
      <rect x="0" y="0" width="64" height="64" rx="18" fill="url(#cs-g)" />
      {/* 气泡 */}
      <path
        d="M12 16h36c6 0 10 4 10 9v8c0 5-4 9-10 9H30l-8 7v-7H18c-6 0-10-4-10-9v-8c0-5 4-9 10-9z"
        fill="#fff" opacity=".95"
      />
      {/* 三点 */}
      <circle cx="26" cy="29" r="3.2" fill="rgba(0,0,0,.35)" />
      <circle cx="34" cy="29" r="3.2" fill="rgba(0,0,0,.35)" />
      <circle cx="42" cy="29" r="3.2" fill="rgba(0,0,0,.35)" />
    </svg>
  );
}

