import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  ShieldCheck,
  BarChart3,
  Settings,
  Menu,
  X,
  Search,
  LogOut,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ChatSphere — Admin Dashboard v0.2
// ▸ 深蓝 + 青紫色系  ▸ 折叠侧栏  ▸ 顶部导航  ▸ 渐变标题  ▸ Recharts 折线图

const GRADIENT = "linear-gradient(135deg, #14E3C1 0%, #6A5CFF 100%)";
const BG_GRID =
  "radial-gradient(60% 40% at 50% 0%, rgba(255,255,255,0.06), transparent), radial-gradient(30% 30% at 0% 100%, rgba(255,255,255,0.04), transparent)";

// 轻量 UI 元素
const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", children, ...rest }) => (
  <div className={"rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl " + className} {...rest}>
    {children}
  </div>
);
const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", children, ...rest }) => (
  <div className={"p-5 pb-2 " + className} {...rest}>{children}</div>
);
const CardTitle: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", children, ...rest }) => (
  <div className={"text-lg font-semibold " + className} {...rest}>{children}</div>
);
const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", children, ...rest }) => (
  <div className={"p-5 pt-0 text-sm text-zinc-300 " + className} {...rest}>{children}</div>
);
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", children, ...rest }) => (
  <button className={"px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition-colors " + className} {...rest}>
    {children}
  </button>
);

// 模拟数据
const msgSeries = [
  { t: "00:00", v: 120 },
  { t: "02:00", v: 240 },
  { t: "04:00", v: 180 },
  { t: "06:00", v: 460 },
  { t: "08:00", v: 820 },
  { t: "10:00", v: 1080 },
  { t: "12:00", v: 920 },
  { t: "14:00", v: 760 },
  { t: "16:00", v: 980 },
  { t: "18:00", v: 1340 },
  { t: "20:00", v: 1520 },
  { t: "22:00", v: 1260 },
];

function NavItem({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode; label: string; active?: boolean; collapsed?: boolean; onClick?: () => void; }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm border transition ${
        active ? "bg-white/15 border-white/25 text-white shadow-[0_0_0_1px_rgba(20,227,193,0.15)]" : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
      } ${collapsed ? "justify-center" : "justify-start"}`}
    >
      <span className="opacity-90">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-zinc-400">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [section, setSection] = useState<string>("analytics");
  const [userSearch, setUserSearch] = useState("");

  // 用户列表数据
  const users = [
    { name: "Alice", status: "Active", messages: 1234 },
    { name: "Bob", status: "Active", messages: 856 },
    { name: "Charlie", status: "Banned", messages: 456 },
    { name: "Diana", status: "Active", messages: 2145 },
    { name: "Eve", status: "Inactive", messages: 123 },
  ];

  // 过滤用户
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0C1424] text-zinc-100 relative overflow-hidden">
      {/* 背景网格/光影 */}
      <div className="pointer-events-none absolute inset-0" style={{ background: BG_GRID }} />

      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0C1424]/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Button className="!px-2" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
            {collapsed ? <Menu className="h-5 w-5"/> : <X className="h-5 w-5"/>}
          </Button>
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 ml-1 w-full max-w-sm">
            <Search className="h-4 w-4 text-zinc-400" />
            <input placeholder="Search in admin…" className="bg-transparent outline-none text-sm w-full" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-xs text-zinc-400 hidden md:block">Owner</div>
            <div className="h-8 w-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">🛡️</div>
            <a href="/home">
              <Button className="!px-2" title="Back to Chat"><LogOut className="h-5 w-5"/></Button>
            </a>
          </div>
        </div>
      </div>

      {/* 主体布局 */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1" style={{ gridTemplateColumns: collapsed ? "64px 1fr" : "260px 1fr" }}>
        {/* 侧边栏 */}
        <aside className={`transition-all duration-300 ${collapsed ? "w-16" : "w-[260px]"}`}>
          <div className="sticky top-20 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-2xl bg-white/10 flex items-center justify-center">💬</div>
              {!collapsed && (
                <div>
                  <div className="font-semibold">ChatSphere Admin</div>
                  <div className="text-xs text-emerald-300">Owner</div>
                </div>
              )}
            </div>

            <NavItem icon={<LayoutDashboard className="h-4 w-4"/>} label="Dashboard" active={section==='dashboard'} collapsed={collapsed} onClick={()=>setSection('dashboard')} />
            <NavItem icon={<Users className="h-4 w-4"/>} label="Users" active={section==='users'} collapsed={collapsed} onClick={()=>setSection('users')} />
            <NavItem icon={<MessageSquare className="h-4 w-4"/>} label="Rooms" active={section==='rooms'} collapsed={collapsed} onClick={()=>setSection('rooms')} />
            <NavItem icon={<ShieldCheck className="h-4 w-4"/>} label="Moderation" active={section==='moderation'} collapsed={collapsed} onClick={()=>setSection('moderation')} />
            <NavItem icon={<BarChart3 className="h-4 w-4"/>} label="Analytics" active={section==='analytics'} collapsed={collapsed} onClick={()=>setSection('analytics')} />
            <NavItem icon={<Settings className="h-4 w-4"/>} label="Settings" active={section==='settings'} collapsed={collapsed} onClick={()=>setSection('settings')} />
          </div>
        </aside>

        {/* 内容区 */}
        <main className="pl-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {/* 切换不同页面内容 */}
            {section === 'dashboard' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Dashboard</h1>
                <p className="text-zinc-400 mt-1">System overview and key metrics</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                  <Stat title="Total Users" value="2,847" />
                  <Stat title="Active Rooms" value="156" />
                  <Stat title="Messages (24h)" value="12.5K" />
                  <Stat title="Reports" value="8" />
                </div>
              </>
            )}

            {section === 'users' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Users</h1>
                <p className="text-zinc-400 mt-1">Manage and monitor user accounts</p>
                <div className="mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>User Management</CardTitle>
                      </div>
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                        <Search className="h-4 w-4 text-zinc-400" />
                        <input
                          type="text"
                          placeholder="Search users by name…"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="bg-transparent outline-none text-sm w-full text-zinc-100"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-xs text-white/60">{user.status} • {user.messages} msgs</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  user.status === "Active"
                                    ? "bg-green-500/20 text-green-300"
                                    : user.status === "Banned"
                                    ? "bg-red-500/20 text-red-300"
                                    : "bg-yellow-500/20 text-yellow-300"
                                }`}>
                                  {user.status}
                                </span>
                                <button className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition" onClick={() => alert(`BAN user: ${user.name}`)}>
                                  BAN
                                </button>
                                <button className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition" onClick={() => alert(`KICK user: ${user.name}`)}>
                                  KICK
                                </button>
                                <button className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition" onClick={() => alert(`DELETE user: ${user.name}`)}>
                                  DEL
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-zinc-400">
                            No users found matching "{userSearch}"
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {section === 'rooms' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Rooms</h1>
                <p className="text-zinc-400 mt-1">Manage chat rooms and channels</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                  {[
                    { name: "General Chat", type: "Official", members: 1543, messages: 5234 },
                    { name: "Photography", type: "Official", members: 342, messages: 3142 },
                    { name: "Music", type: "Official", members: 289, messages: 2856 },
                    { name: "My Cool Room", type: "User", members: 12, messages: 234 },
                  ].map((room, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                          <span>{room.name}</span>
                          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">{room.type}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">👥 Members: {room.members}</p>
                        <p className="text-sm">💬 Messages: {room.messages}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {section === 'moderation' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Moderation</h1>
                <p className="text-zinc-400 mt-1">Review and manage user reports</p>
                <div className="mt-6">
                  <Card>
                    <CardHeader><CardTitle>Recent Reports</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { user: "Charlie", reason: "Spam messages", status: "pending" },
                          { user: "Dave", reason: "Inappropriate content", status: "resolved" },
                          { user: "Eve", reason: "Harassment", status: "pending" },
                        ].map((report, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                            <div>
                              <p className="font-medium">{report.user}</p>
                              <p className="text-xs text-white/60">{report.reason}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                              {report.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {section === 'analytics' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Analytics</h1>
                <p className="text-zinc-400 mt-1">Activity and engagement metrics</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Stat title="Online now" value="32" />
                  <Stat title="Messages (24h)" value="5,432" />
                  <Stat title="DAU" value="128" />
                </div>
                <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle>Messages over 24 hours</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={msgSeries} margin={{ top: 10, right: 12, bottom: 0, left: -6 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                            <XAxis dataKey="t" tick={{ fill: "#9CA3AF", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
                            <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
                            <Tooltip contentStyle={{ background: "rgba(20,20,30,0.9)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff" }} />
                            <Line type="monotone" dataKey="v" stroke="#6A5CFF" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Peak hours & Top rooms</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        <li>8–10 PM: <b>2,341</b> msgs</li>
                        <li>9–11 PM: <b>2,156</b> msgs</li>
                        <li>7–9 PM: <b>1,892</b> msgs</li>
                      </ul>
                      <div className="mt-4 text-zinc-300">
                        <div>💬 General Chat — <b>5,234</b></div>
                        <div>📸 Photography — <b>3,142</b></div>
                        <div>🎵 Music — <b>2,856</b></div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {section === 'settings' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Settings</h1>
                <p className="text-zinc-400 mt-1">Configure system-wide settings</p>
                <div className="mt-6">
                  <Card>
                    <CardHeader><CardTitle>System Configuration</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                          <p className="font-medium">Slow Mode (seconds)</p>
                          <input type="number" defaultValue={0} className="w-20 bg-white/10 border border-white/10 rounded px-2 py-1 text-sm" />
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                          <p className="font-medium">Max Message Length</p>
                          <input type="number" defaultValue={5000} className="w-20 bg-white/10 border border-white/10 rounded px-2 py-1 text-sm" />
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="font-medium">Enable Reports</p>
                          <input type="checkbox" defaultChecked className="w-5 h-5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
