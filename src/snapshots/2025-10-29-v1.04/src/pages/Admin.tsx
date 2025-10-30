import React, { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  ShieldCheck,
  BarChart3,
  Globe2,
  Settings,
  Search,
  MoreHorizontal,
  Trash2,
  Ban,
  Eye,
  Lock,
  Unlock,
  ChevronDown,
  Upload,
  Download,
  Globe,
  Link as LinkIcon,
} from "lucide-react";

// Types
type Role = "owner" | "admin" | "moderator";
type User = {
  id: string;
  nickname: string;
  age?: number | null;
  gender?: string | null;
  country?: string | null;
  isGuest?: boolean;
  status: "active" | "banned" | "frozen";
  createdAt: string;
  lastSeen: string;
  messages?: number;
};

type Room = {
  id: string;
  name: string;
  visibility: "public" | "private";
  createdAt: string;
  members: number;
  slowMode?: number;
  announcements?: string[];
};

// Mock Data
const MOCK_USERS: User[] = [
  {
    id: "u_1",
    nickname: "真命天子",
    age: 32,
    gender: "male",
    country: "Mexico",
    isGuest: false,
    status: "active",
    createdAt: "2025-10-20",
    lastSeen: new Date().toISOString(),
    messages: 452,
  },
  {
    id: "u_2",
    nickname: "我要炸了168",
    age: 24,
    gender: "female",
    country: "United States",
    isGuest: true,
    status: "active",
    createdAt: "2025-10-26",
    lastSeen: "2025-10-29T03:12:00Z",
    messages: 88,
  },
  {
    id: "u_3",
    nickname: "Maybe",
    age: 23,
    gender: "male",
    country: "USA",
    isGuest: true,
    status: "frozen",
    createdAt: "2025-10-25",
    lastSeen: "2025-10-28T19:33:00Z",
    messages: 9,
  },
];

const MOCK_ROOMS: Room[] = [
  {
    id: "r_official_1",
    name: "Official Lounge",
    visibility: "public",
    createdAt: "2025-10-19",
    members: 102,
    slowMode: 3,
  },
  {
    id: "r_user_1",
    name: "我是英雄",
    visibility: "public",
    createdAt: "2025-10-28",
    members: 2,
    slowMode: 0,
    announcements: ["欢迎加入 ChatSphere！"],
  },
  {
    id: "r_private_a",
    name: "Super3 · DM",
    visibility: "private",
    createdAt: "2025-10-27",
    members: 2,
    slowMode: 0,
  },
];

// UI Components
const SectionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl border transition-colors text-sm
      ${
        active
          ? "bg-white/15 border-white/25 text-white"
          : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
      }`}
  >
    <span className="opacity-90">{icon}</span>
    <span className="truncate">{label}</span>
  </button>
);

const StatCard: React.FC<{
  title: string;
  value: string;
  hint?: string;
}> = ({ title, value, hint }) => (
  <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
    <div className="text-sm font-medium text-zinc-400 mb-2">{title}</div>
    <div className="text-3xl font-semibold">{value}</div>
    {hint && <div className="text-xs text-zinc-400 mt-1">{hint}</div>}
  </div>
);

const badge = (text: string) => {
  const styles: Record<string, string> = {
    active:
      "bg-emerald-500/20 text-emerald-300 border-emerald-400/20",
    frozen:
      "bg-amber-500/15 text-amber-300 border-amber-400/20",
    banned: "bg-rose-500/20 text-rose-300 border-rose-400/20",
    public: "bg-white/10 text-zinc-200 border-white/15",
    private: "bg-white/10 text-zinc-200 border-white/15",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs border ${
        styles[text] || "bg-white/10 text-zinc-200 border-white/15"
      }`}
    >
      {text}
    </span>
  );
};

const IconBtn: React.FC<{ title: string; icon: React.ReactNode }> = ({
  title,
  icon,
}) => (
  <button
    title={title}
    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
  >
    {icon}
  </button>
);

const InputRow: React.FC<{
  label: string;
  placeholder?: string;
  multi?: boolean;
}> = ({ label, placeholder, multi }) => (
  <label className="block">
    <div className="mb-1 text-xs text-zinc-400">{label}</div>
    {multi ? (
      <textarea
        placeholder={placeholder}
        className="w-full min-h-[96px] rounded-xl bg-white/5 border border-white/10 p-3 outline-none text-white"
      />
    ) : (
      <input
        placeholder={placeholder}
        className="w-full rounded-xl bg-white/5 border border-white/10 p-3 outline-none text-white"
      />
    )}
  </label>
);

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-sm hover:bg-white/15 transition-colors flex items-center gap-2"
  >
    {children}
  </button>
);

// Sections
function DashboardOverview() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Online" value="2" hint="right now" />
        <StatCard title="DAU" value="28" hint="last 24h" />
        <StatCard title="Messages" value="1,245" hint="last 24h" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          <ul className="text-sm text-zinc-300 space-y-2">
            <li>• User <b>真命天子</b> created room <b>我是英雄</b>.</li>
            <li>• Updated slow mode in <b>Official Lounge</b> to 3s.</li>
            <li>• Kicked spam user <b>bot-9382</b>.</li>
          </ul>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <Button>New Announcement</Button>
            <Button>Create Official Room</Button>
            <Button>Export Users CSV</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersSection() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const data = useMemo(() => {
    const query = q.trim().toLowerCase();
    return MOCK_USERS.filter((u) => {
      const hitQ =
        !query ||
        u.nickname.toLowerCase().includes(query) ||
        (u.country || "").toLowerCase().includes(query);
      const hitS = status === "all" || u.status === status;
      return hitQ && hitS;
    });
  }, [q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users…"
            className="bg-transparent outline-none text-white placeholder:text-zinc-500"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
          <span className="text-sm text-zinc-400">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-transparent outline-none text-white"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="frozen">Frozen</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Country</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Msgs</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {data.map((u) => (
              <tr key={u.id} className="hover:bg-white/5">
                <td className="p-3">
                  <div className="font-medium">
                    {u.nickname}
                    {u.isGuest && (
                      <span className="ml-2 text-xs text-zinc-400">guest</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {u.gender ?? "—"} · {u.age ?? "—"} ·{" "}
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="p-3">{u.country ?? "—"}</td>
                <td className="p-3">{badge(u.status)}</td>
                <td className="p-3">{u.messages ?? 0}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <IconBtn title="View" icon={<Eye className="h-4 w-4" />} />
                    {u.status !== "banned" ? (
                      <IconBtn title="Ban" icon={<Ban className="h-4 w-4" />} />
                    ) : (
                      <IconBtn
                        title="Unban"
                        icon={<Unlock className="h-4 w-4" />}
                      />
                    )}
                    {u.status !== "frozen" ? (
                      <IconBtn
                        title="Freeze"
                        icon={<Lock className="h-4 w-4" />}
                      />
                    ) : (
                      <IconBtn
                        title="Unfreeze"
                        icon={<Unlock className="h-4 w-4" />}
                      />
                    )}
                    <IconBtn
                      title="Delete"
                      icon={<Trash2 className="h-4 w-4" />}
                    />
                    <MoreHorizontal className="h-4 w-4 text-zinc-400" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoomsSection() {
  const [q, setQ] = useState("");
  const data = useMemo(() => {
    const query = q.trim().toLowerCase();
    return MOCK_ROOMS.filter((r) => !query || r.name.toLowerCase().includes(query));
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rooms…"
            className="bg-transparent outline-none text-white placeholder:text-zinc-500"
          />
        </div>
        <Button>New Official Room</Button>
      </div>

      <div className="rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="text-left p-3">Room</th>
              <th className="text-left p-3">Visibility</th>
              <th className="text-left p-3">Members</th>
              <th className="text-left p-3">Slow Mode</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {data.map((r) => (
              <tr key={r.id} className="hover:bg-white/5">
                <td className="p-3">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-zinc-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="p-3">{badge(r.visibility)}</td>
                <td className="p-3">{r.members}</td>
                <td className="p-3">{r.slowMode ? `${r.slowMode}s` : "off"}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <IconBtn
                      title="Announce"
                      icon={<Upload className="h-4 w-4" />}
                    />
                    <IconBtn
                      title="Export Chat"
                      icon={<Download className="h-4 w-4" />}
                    />
                    <IconBtn
                      title="Delete"
                      icon={<Trash2 className="h-4 w-4" />}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModerationSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <h3 className="font-semibold mb-4">Block/Kick/Report Policies</h3>
        <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-2">
          <li>Per-room <b>slow mode</b> to limit spam bursts.</li>
          <li><b>Kick</b> removes a user from a room; repeated abuse → ban.</li>
          <li><b>Block</b> is personal; hides messages & DMs from the blocked user.</li>
          <li>Word filters & link-only throttling for new accounts.</li>
        </ul>
        <div className="mt-4 flex gap-2">
          <Button>Open Reports Queue</Button>
          <Button>Edit Filters</Button>
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <h3 className="font-semibold mb-4">Announcements</h3>
        <textarea
          className="w-full min-h-[120px] rounded-xl bg-white/5 border border-white/10 p-3 outline-none text-white placeholder:text-zinc-500"
          placeholder="Write a global announcement…"
        />
        <div className="mt-3 flex gap-2">
          <Button>Preview</Button>
          <Button>Publish</Button>
        </div>
      </div>
    </div>
  );
}

function SEOSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <h3 className="font-semibold mb-4">Meta Tags</h3>
        <div className="space-y-3">
          <InputRow
            label="Title"
            placeholder="ChatSphere — Real-time Social Chat Community"
          />
          <InputRow
            label="Description"
            placeholder="A clean, respectful place to talk. Start rooms or DMs instantly."
            multi
          />
          <InputRow
            label="Keywords"
            placeholder="chat, realtime, community, chatsphere"
          />
          <div className="flex gap-2">
            <Button>Save</Button>
            <Button>
              <Globe className="h-4 w-4" /> Preview
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <h3 className="font-semibold mb-4">Sitemaps & Robots</h3>
        <div className="space-y-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
            <div className="font-medium mb-2">robots.txt</div>
            <pre className="whitespace-pre-wrap text-xs text-zinc-300">{`User-agent: *\nDisallow: /admin\nSitemap: https://chatsphere.com/sitemap.xml`}</pre>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
            <div className="font-medium mb-2">Open Graph</div>
            <div className="text-zinc-300">og:title, og:description, og:image, twitter:card…</div>
          </div>
          <div className="flex gap-2">
            <Button>Regenerate sitemap.xml</Button>
            <Button>
              <LinkIcon className="h-4 w-4" /> Submit to Search Console
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsSection() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Visitors (24h)" value="63" />
        <StatCard title="Signups (24h)" value="7" />
        <StatCard title="Retention (D1)" value="42%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
          <h3 className="font-semibold mb-4">Traffic by Source</h3>
          <div className="text-sm text-zinc-300">
            google (36), direct (20), referral (7)
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            * Hook up to your analytics backend (Tinybird, PostHog, Plausible, or your own).
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
          <h3 className="font-semibold mb-4">Message Velocity</h3>
          <div className="text-sm text-zinc-300">Last hour: 112 messages</div>
          <div className="text-xs text-zinc-500 mt-2">
            Chart placeholder — connect your time-series.
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <h3 className="font-semibold mb-4">Access Control</h3>
        <div className="text-sm text-zinc-300 mb-3">
          Define roles and permissions for Owner / Admin / Moderator.
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm mb-4">
          <ul className="list-disc pl-5 space-y-1 text-zinc-300">
            <li>Owner: full access, billing, system settings</li>
            <li>Admin: users/rooms/moderation, SEO & analytics</li>
            <li>Moderator: moderation + room tools</li>
          </ul>
        </div>
        <Button>Configure RBAC</Button>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-6">
        <h3 className="font-semibold mb-4">Branding</h3>
        <div className="space-y-3">
          <InputRow label="Site Name" placeholder="ChatSphere" />
          <InputRow label="Primary Gradient" placeholder="#14E3C1 → #6956FF" />
          <Button>Save</Button>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function AdminDashboard() {
  const [section, setSection] = useState<string>("dashboard");

  return (
    <div className="min-h-screen bg-black text-zinc-100 relative overflow-hidden">
      {/* Background texture */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(255,255,255,0.07),transparent),radial-gradient(30%_30%_at_0%_100%,rgba(255,255,255,0.05),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
        {/* Sidebar */}
        <aside className="h-fit lg:h-[calc(100vh-4rem)] rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-4 sticky top-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-2xl bg-white/10 flex items-center justify-center text-lg">
              🛡️
            </div>
            <div>
              <div className="font-semibold">ChatSphere Admin</div>
              <div className="text-xs text-zinc-400">Owner</div>
            </div>
          </div>

          <div className="space-y-2">
            <SectionButton
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Dashboard"
              active={section === "dashboard"}
              onClick={() => setSection("dashboard")}
            />
            <SectionButton
              icon={<Users className="h-4 w-4" />}
              label="Users"
              active={section === "users"}
              onClick={() => setSection("users")}
            />
            <SectionButton
              icon={<MessageSquare className="h-4 w-4" />}
              label="Rooms"
              active={section === "rooms"}
              onClick={() => setSection("rooms")}
            />
            <SectionButton
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Moderation"
              active={section === "moderation"}
              onClick={() => setSection("moderation")}
            />
            <SectionButton
              icon={<Globe2 className="h-4 w-4" />}
              label="SEO Tools"
              active={section === "seo"}
              onClick={() => setSection("seo")}
            />
            <SectionButton
              icon={<BarChart3 className="h-4 w-4" />}
              label="Analytics"
              active={section === "analytics"}
              onClick={() => setSection("analytics")}
            />
            <SectionButton
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              active={section === "settings"}
              onClick={() => setSection("settings")}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main>
          {section === "dashboard" && <DashboardOverview />}
          {section === "users" && <UsersSection />}
          {section === "rooms" && <RoomsSection />}
          {section === "moderation" && <ModerationSection />}
          {section === "seo" && <SEOSection />}
          {section === "analytics" && <AnalyticsSection />}
          {section === "settings" && <SettingsSection />}
        </main>
      </div>
    </div>
  );
}
