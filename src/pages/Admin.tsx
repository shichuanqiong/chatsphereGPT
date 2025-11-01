import React, { useState, useEffect } from "react";
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
  Zap,
  RefreshCw,
  BookOpen,
  Trash2,
  Edit2,
  Plus,
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
import { useAnalyticsStream, useAdminUsers, useAdminRooms, useAdminReports } from "@/hooks/useAnalyticsStream";
import AdminAPI from "@/lib/api";
import { db } from "@/firebase";
import { ref, onValue, push, set, remove, update } from "firebase/database";

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
  const [section, setSection] = useState<string>(() => {
    // 从 localStorage 加载上次访问的版块
    try {
      return localStorage.getItem('admin-section') || "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const [userSearch, setUserSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"Official" | "User">("User");
  
  // System Settings 状态
  const initSettings = () => {
    try {
      const saved = localStorage.getItem('system-settings');
      console.log('[Admin] Loading settings from localStorage:', saved);
      if (saved) {
        const config = JSON.parse(saved);
        console.log('[Admin] Parsed settings:', config);
        return config;
      }
    } catch (error) {
      console.error('Failed to load system settings from localStorage:', error);
    }
    console.log('[Admin] No saved settings found, using defaults');
    return null;
  };

  const savedSettings = initSettings();
  const [slowMode, setSlowMode] = useState(savedSettings?.slowMode ?? 0);
  const [maxMessageLength, setMaxMessageLength] = useState(savedSettings?.maxMessageLength ?? 5000);
  const [enableReports, setEnableReports] = useState(savedSettings?.enableReports ?? true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  
  // SEO 工具状态 - 从 localStorage 初始化
  const initSeoConfig = () => {
    try {
      const saved = localStorage.getItem('seo-config');
      if (saved) {
        const config = JSON.parse(saved);
        return config;
      }
    } catch (error) {
      console.error('Failed to load SEO config from localStorage:', error);
    }
    return null;
  };

  const savedConfig = initSeoConfig();
  const [seoTitle, setSeoTitle] = useState(savedConfig?.title || "ChatSphere — Free Real-time Chat Rooms & Anonymous Community");
  const [seoDescription, setSeoDescription] = useState(savedConfig?.description || "Join ChatSphere to chat freely and instantly. Create rooms, talk to strangers or friends — no registration required.");
  const [seoKeywords, setSeoKeywords] = useState(savedConfig?.keywords || "free chat room, anonymous chat, realtime chat, talk to strangers");
  const [robotsTxt, setRobotsTxt] = useState(savedConfig?.robotsTxt || "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/*\nDisallow: /*.js$\nDisallow: /*.css$\nDisallow: /*?*\n\nCrawl-delay: 1\nRequest-rate: 1/10s\n\nSitemap: https://chatsphere.live/sitemap.xml");
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapResult, setSitemapResult] = useState<any>(null);
  const [seoSaving, setSeoSaving] = useState(false);
  
  // 用户筛选状态
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Blog 管理状态
  const [blogs, setBlogs] = useState<any[]>([]);
  const [blogSearch, setBlogSearch] = useState("");
  const [showCreateBlog, setShowCreateBlog] = useState(false);
  const [editingBlog, setEditingBlog] = useState<any>(null);
  const [newBlogTitle, setNewBlogTitle] = useState("");
  const [newBlogSlug, setNewBlogSlug] = useState("");
  const [newBlogExcerpt, setNewBlogExcerpt] = useState("");
  const [newBlogContent, setNewBlogContent] = useState("");
  const [blogSaving, setBlogSaving] = useState(false);

  // 每次 section 变更时，保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('admin-section', section);
    } catch (error) {
      console.error('Failed to save admin-section:', error);
    }
  }, [section]);

  // 加载 Blogs 数据
  useEffect(() => {
    if (!db) return;
    const postsRef = ref(db, '/posts');
    const unsubscribe = onValue(postsRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, val]: any) => ({ id, ...val }));
      arr.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setBlogs(arr);
    });
    return unsubscribe;
  }, []);

  // 实时分析数据
  const { data: liveMetrics, connected: metricsConnected } = useAnalyticsStream();
  
  // 用户和房间实时数据
  const { users: fetchedUsers, loading: usersLoading, refetch: refetchUsers } = useAdminUsers();
  const { rooms: fetchedRooms, loading: roomsLoading } = useAdminRooms();
  const { reports: fetchedReports, loading: reportsLoading } = useAdminReports();

  // 使用真实数据或备用数据
  const users = fetchedUsers || [];
  const allRooms = fetchedRooms || [];

  // 过滤用户
  const filteredUsers = users
    .filter(user =>
      user.name.toLowerCase().includes(userSearch.toLowerCase()) &&
      (userStatusFilter === 'all' || user.status === userStatusFilter)
    )
    .sort((a, b) => {
      // 在线用户排在最前面
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      // 同状态下按名字排序
      return a.name.localeCompare(b.name);
    });

  // 过滤房间
  const filteredRooms = allRooms.filter(room =>
    room.name.toLowerCase().includes(roomSearch.toLowerCase())
  );

  // Sitemap 生成
  const handleGenerateSitemap = async () => {
    setSitemapLoading(true);
    try {
      const result = await AdminAPI.generateSitemap();
      setSitemapResult(result);
      console.log('Sitemap generated:', result);
    } catch (error: any) {
      console.error('Failed to generate sitemap:', error);
      setSitemapResult({ error: error.message });
    } finally {
      setSitemapLoading(false);
    }
  };

  // System Settings 保存
  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const settings = {
        slowMode,
        maxMessageLength,
        enableReports,
        savedAt: new Date().toISOString(),
      };
      
      // 保存到 localStorage（本地持久化）
      localStorage.setItem('system-settings', JSON.stringify(settings));
      
      console.log('System settings saved:', settings);
      alert('✅ System settings saved successfully!');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      alert(`❌ Save failed: ${error.message}`);
    } finally {
      setSettingsSaving(false);
    }
  };

  // SEO 配置保存
  const handleSaveSEOConfig = async () => {
    setSeoSaving(true);
    try {
      const seoConfig = {
        title: seoTitle,
        description: seoDescription,
        keywords: seoKeywords,
        robotsTxt: robotsTxt,
        savedAt: new Date().toISOString(),
      };
      
      // 保存到 localStorage（本地持久化）
      localStorage.setItem('seo-config', JSON.stringify(seoConfig));
      
      console.log('SEO configuration saved:', seoConfig);
      alert('✅ SEO 配置已保存成功！');
    } catch (error: any) {
      console.error('Failed to save SEO config:', error);
      alert(`❌ 保存失败: ${error.message}`);
    } finally {
      setSeoSaving(false);
    }
  };

  // 用户操作处理
  const handleBanUser = async (user: any) => {
    if (!window.confirm(`确定要禁封用户 "${user.name}" 吗？`)) return;
    try {
      const result = await AdminAPI.banUser(user.uid, '被管理员禁封');
      alert(`✅ ${result.message}`);
      // 重新获取用户列表而不是刷新整个页面
      setTimeout(() => {
        // 直接重新获取用户数据
        refetchUsers();
      }, 500);
    } catch (error: any) {
      alert(`❌ 禁封失败: ${error.message}`);
    }
  };

  const handleKickUser = async (user: any) => {
    if (!window.confirm(`确定要踢出用户 "${user.name}" 吗？`)) return;
    try {
      const result = await AdminAPI.kickUser(user.uid);
      alert(`✅ ${result.message}`);
      // 重新获取用户列表
      setTimeout(() => {
        refetchUsers();
      }, 500);
    } catch (error: any) {
      alert(`❌ 踢出失败: ${error.message}`);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`确定要删除用户 "${user.name}" 吗？此操作不可恢复！`)) return;
    try {
      const result = await AdminAPI.deleteUser(user.uid);
      alert(`✅ ${result.message}`);
      // 不刷新页面，只刷新用户列表
      // 用户列表会在 useAdminUsers hook 中自动更新
      setTimeout(() => refetchUsers(), 500);
    } catch (error: any) {
      alert(`❌ 删除失败: ${error.message}`);
    }
  };

  // 创建房间
  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      alert('❌ 房间名称不能为空');
      return;
    }
    alert(`✅ 房间 "${newRoomName}" 已创建（${newRoomType}）`);
    setNewRoomName("");
    setShowCreateRoom(false);
  };

  // 删除房间
  const handleDeleteRoom = (roomId: string, roomName: string) => {
    if (window.confirm(`确定要删除房间 "${roomName}" 吗？`)) {
      alert(`✅ 房间已删除`);
    }
  };

  // Blog 管理函数
  const handleSaveBlog = async () => {
    if (!newBlogTitle.trim() || !newBlogSlug.trim() || !newBlogContent.trim()) {
      alert('❌ 标题、URL 别名和内容不能为空');
      return;
    }
    
    setBlogSaving(true);
    try {
      if (editingBlog) {
        // 编辑现有博客
        await update(ref(db, `/posts/${editingBlog.id}`), {
          title: newBlogTitle,
          slug: newBlogSlug,
          excerpt: newBlogExcerpt,
          content: newBlogContent,
        });
        alert('✅ 博客已更新');
        setEditingBlog(null);
      } else {
        // 创建新博客
        const newPostRef = push(ref(db, 'posts'));
        await set(newPostRef, {
          title: newBlogTitle,
          slug: newBlogSlug,
          excerpt: newBlogExcerpt,
          content: newBlogContent,
          createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
        });
        alert('✅ 博客已创建');
      }
      setNewBlogTitle("");
      setNewBlogSlug("");
      setNewBlogExcerpt("");
      setNewBlogContent("");
      setShowCreateBlog(false);
    } catch (error: any) {
      alert(`❌ 保存失败: ${error.message}`);
    } finally {
      setBlogSaving(false);
    }
  };

  const handleDeleteBlog = async (blogId: string, blogTitle: string) => {
    if (!window.confirm(`确定要删除博客 "${blogTitle}" 吗？`)) return;
    try {
      await remove(ref(db, `/posts/${blogId}`));
      alert('✅ 博客已删除');
    } catch (error: any) {
      alert(`❌ 删除失败: ${error.message}`);
    }
  };

  const handleEditBlog = (blog: any) => {
    setEditingBlog(blog);
    setNewBlogTitle(blog.title);
    setNewBlogSlug(blog.slug);
    setNewBlogExcerpt(blog.excerpt);
    setNewBlogContent(blog.content);
    setShowCreateBlog(true);
  };

  const handleCancelBlog = () => {
    setShowCreateBlog(false);
    setEditingBlog(null);
    setNewBlogTitle("");
    setNewBlogSlug("");
    setNewBlogExcerpt("");
    setNewBlogContent("");
  };

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
            <a href="/chatsphereGPT/#/home">
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
            <NavItem icon={<BookOpen className="h-4 w-4"/>} label="Blog" active={section==='blog'} collapsed={collapsed} onClick={()=>setSection('blog')} />
            <NavItem icon={<Zap className="h-4 w-4"/>} label="SEO Tools" active={section==='seo'} collapsed={collapsed} onClick={()=>setSection('seo')} />
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
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
                  <Stat title="Online now" value={String(users.filter(u => u.status === 'online').length)} />
                  <Stat title="Messages (24h)" value={String(liveMetrics?.msg24h ?? 0)} />
                  <Stat title="DAU" value={String(liveMetrics?.dau ?? 0)} />
                  <Stat title="Total Users" value={String(users.length)} />
                  <Stat title="Active Rooms" value={String(allRooms.length)} />
                </div>
              </>
            )}

            {section === 'users' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Users</h1>
                <p className="text-zinc-400 mt-1">Manage and monitor user accounts {usersLoading && '⏳'}</p>
                
                {/* 用户统计卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Stat title="Total Users" value={String(users.length)} />
                  <Stat title="Online" value={String(users.filter(u => u.status === 'online').length)} />
                  <Stat title="Offline" value={String(users.filter(u => u.status === 'offline').length)} />
                </div>

                <div className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>User Management</CardTitle>
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

                      {/* 状态筛选按钮 */}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setUserStatusFilter('all')}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                            userStatusFilter === 'all'
                              ? 'bg-cyan-500 text-white'
                              : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setUserStatusFilter('online')}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                            userStatusFilter === 'online'
                              ? 'bg-green-500 text-white'
                              : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                          }`}
                        >
                          🟢 Online
                        </button>
                        <button
                          onClick={() => setUserStatusFilter('offline')}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                            userStatusFilter === 'offline'
                              ? 'bg-gray-500 text-white'
                              : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                          }`}
                        >
                          ⚫ Offline
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {usersLoading ? (
                          <div className="text-center py-6 text-zinc-400">⏳ Loading users...</div>
                        ) : filteredUsers.length > 0 ? (
                          filteredUsers.map((user, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-xs text-white/60">{user.status} • {user.messageCount} msgs</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  user.status === "Active" || user.status === "online"
                                    ? "bg-green-500/20 text-green-300"
                                    : user.status === "Banned" || user.status === "banned"
                                    ? "bg-red-500/20 text-red-300"
                                    : "bg-yellow-500/20 text-yellow-300"
                                }`}>
                                  {user.status}
                                </span>
                                <button className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition" onClick={() => handleBanUser(user)}>
                                  BAN
                                </button>
                                <button className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition" onClick={() => handleKickUser(user)}>
                                  KICK
                                </button>
                                <button className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition" onClick={() => handleDeleteUser(user)}>
                                  DEL
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-zinc-400">
                            {userSearch ? `No users found matching "${userSearch}"` : 'No users available'}
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
                <p className="text-zinc-400 mt-1">Manage chat rooms and channels {roomsLoading && '⏳'}</p>
                <div className="mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Room Management</CardTitle>
                        <Button onClick={() => setShowCreateRoom(true)}>Create Room</Button>
                      </div>
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                        <Search className="h-4 w-4 text-zinc-400" />
                        <input
                          type="text"
                          placeholder="Search rooms by name…"
                          value={roomSearch}
                          onChange={(e) => setRoomSearch(e.target.value)}
                          className="bg-transparent outline-none text-sm w-full text-zinc-100"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {roomsLoading ? (
                          <div className="text-center py-6 text-zinc-400">⏳ Loading rooms...</div>
                        ) : filteredRooms.length > 0 ? (
                          filteredRooms.map((room, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                              <div>
                                <p className="font-medium">{room.name}</p>
                                <p className="text-xs text-white/60">Type: {room.type} • Members: {room.memberCount} • Messages: {room.messageCount}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${room.type === "Official" ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"}`}>
                                  {room.type}
                                </span>
                                <button className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition">
                                  Edit
                                </button>
                                <button className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition" onClick={() => alert(`DELETE room: ${room.name}`)}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-zinc-400">
                            {roomSearch ? `No rooms found matching "${roomSearch}"` : 'No rooms available'}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {showCreateRoom && (
                  <div className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Create New Room</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Room Name</label>
                            <input
                              type="text"
                              value={newRoomName}
                              onChange={(e) => setNewRoomName(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:border-white/30 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Room Type</label>
                            <select
                              value={newRoomType}
                              onChange={(e) => setNewRoomType(e.target.value as "Official" | "User")}
                              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:border-white/30 outline-none cursor-pointer"
                              style={{ colorScheme: 'dark' }}
                            >
                              <option value="Official" style={{ color: 'white', backgroundColor: '#1a1f35' }}>Official</option>
                              <option value="User" style={{ color: 'white', backgroundColor: '#1a1f35' }}>User</option>
                            </select>
                          </div>
                          <Button onClick={handleCreateRoom}>Create Room</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}

            {section === 'moderation' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Moderation</h1>
                <p className="text-zinc-400 mt-1">Review and manage user reports {reportsLoading && '⏳'}</p>
                <div className="mt-6">
                  <Card>
                    <CardHeader><CardTitle>Recent Reports</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {reportsLoading ? (
                          <div className="text-center py-6 text-zinc-400">⏳ Loading reports...</div>
                        ) : fetchedReports && fetchedReports.length > 0 ? (
                          fetchedReports.slice(0, 10).map((report, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                              <div>
                                <p className="font-medium">{report.userName}</p>
                                <p className="text-xs text-white/60">{report.reason}</p>
                                {report.description && (
                                  <p className="text-xs text-white/40 mt-1">{report.description}</p>
                                )}
                              </div>
                              <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ml-2 ${
                                report.status === 'pending' 
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : report.status === 'resolved'
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-red-500/20 text-red-300'
                              }`}>
                                {report.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-zinc-400">
                            No reports available
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {section === 'analytics' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Analytics</h1>
                <p className="text-zinc-400 mt-1">Activity and engagement metrics {metricsConnected && '🟢'}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Stat title="Online now" value={String(users.filter(u => u.status === 'online').length)} />
                  <Stat title="Messages (24h)" value={String(liveMetrics?.msg24h ?? 0)} />
                  <Stat title="DAU" value={String(liveMetrics?.dau ?? 0)} />
                </div>
                <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle>Messages over 24 hours</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart 
                            data={(liveMetrics?.buckets || []).map(b => ({ t: `${String(b.h).padStart(2, '0')}:00`, v: b.c }))} 
                            margin={{ top: 10, right: 12, bottom: 0, left: -6 }}
                          >
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
                      <div>
                        <div className="text-sm text-zinc-400 mb-3">📊 24h Peak Activity</div>
                        <ul className="space-y-2 mb-4">
                          {(liveMetrics?.buckets || [])
                            .map((b, i) => ({ h: b.h, c: b.c, i }))
                            .sort((a, b) => b.c - a.c)
                            .slice(0, 3)
                            .map((item, idx) => (
                              <li key={idx}>
                                <b>{String(item.h).padStart(2, '0')}:00</b> — <span className="text-emerald-300">{item.c} msgs</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                      <div className="mt-4 text-zinc-300 border-t border-white/10 pt-4">
                        <div className="text-sm text-zinc-400 mb-3">💬 Top Rooms</div>
                        {(liveMetrics?.topRooms || []).slice(0, 3).map((room, idx) => (
                          <div key={idx} className="mb-2">
                            {idx === 0 && '🥇'}{idx === 1 && '🥈'}{idx === 2 && '🥉'} <b>{room.name}</b> — <span className="text-cyan-300">{room.count}</span>
                          </div>
                        ))}
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
                          <input 
                            type="number" 
                            value={slowMode}
                            onChange={(e) => setSlowMode(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-20 bg-white/10 border border-white/10 rounded px-2 py-1 text-sm text-white"
                            min="0"
                          />
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                          <p className="font-medium">Max Message Length</p>
                          <input 
                            type="number" 
                            value={maxMessageLength}
                            onChange={(e) => setMaxMessageLength(Math.max(1, parseInt(e.target.value) || 100))}
                            className="w-24 bg-white/10 border border-white/10 rounded px-2 py-1 text-sm text-white"
                            min="1"
                          />
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                          <p className="font-medium">Enable Reports</p>
                          <input 
                            type="checkbox" 
                            checked={enableReports}
                            onChange={(e) => setEnableReports(e.target.checked)}
                            className="w-5 h-5 cursor-pointer"
                          />
                        </div>
                        
                        {/* 保存按钮 */}
                        <div className="mt-6 flex gap-3">
                          <button 
                            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
                            onClick={handleSaveSettings}
                            disabled={settingsSaving}
                          >
                            {settingsSaving ? '💾 Saving...' : '💾 Save Settings'}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {section === 'seo' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🔍 SEO Tools</h1>
                <p className="text-zinc-400 mt-1">Manage SEO metadata, robots.txt & sitemap</p>
                
                {/* 基础 SEO 卡片 */}
                <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
                  <h2 className="text-lg font-semibold mb-4">基础信息</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">页面标题 (Title)</label>
                      <input
                        type="text"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">描述 (Meta Description)</label>
                      <textarea
                        value={seoDescription}
                        onChange={(e) => setSeoDescription(e.target.value)}
                        className="w-full min-h-[90px] px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">关键词 (Keywords)</label>
                      <input
                        type="text"
                        value={seoKeywords}
                        onChange={(e) => setSeoKeywords(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 社交媒体卡片 */}
                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Social & Open Graph</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">规范 URL (Canonical Base)</label>
                      <input
                        type="text"
                        defaultValue="https://chatsphere.live"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Open Graph 图像 URL</label>
                      <input
                        type="text"
                        defaultValue="https://chatsphere.live/og.jpg"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
                      />
                      <p className="text-xs text-zinc-500 mt-1">用于分享到 Facebook、LinkedIn 等平台</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Twitter Card 类型</label>
                      <select className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none cursor-pointer" style={{ colorScheme: 'dark' }}>
                        <option value="summary" style={{ color: 'white', backgroundColor: '#1a1f35' }}>summary (小卡片)</option>
                        <option value="summary_large_image" style={{ color: 'white', backgroundColor: '#1a1f35' }} selected>summary_large_image (大图)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Robots.txt 编辑器 */}
                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Robots.txt</h2>
                  <div className="space-y-2">
                    <textarea
                      value={robotsTxt}
                      onChange={(e) => setRobotsTxt(e.target.value)}
                      className="w-full min-h-[160px] px-4 py-3 rounded-xl bg-black/20 text-white border border-white/10 focus:border-white/30 transition-all outline-none resize-none font-mono text-sm"
                    />
                    <p className="text-xs text-zinc-500">搜索引擎爬虫的抓取规则</p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="mt-4 flex gap-3 flex-wrap">
                  <button 
                    className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
                    onClick={handleSaveSEOConfig}
                    disabled={seoSaving}
                  >
                    {seoSaving ? '保存中...' : '💾 保存配置'}
                  </button>
                  <button 
                    className="px-6 py-3 rounded-xl font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all disabled:opacity-50"
                    onClick={handleGenerateSitemap}
                    disabled={sitemapLoading}
                  >
                    {sitemapLoading ? '生成中...' : '🗺️ 重新生成 Sitemap'}
                  </button>
                </div>

                {/* Sitemap 生成结果 */}
                {sitemapResult && (
                  <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
                    <h2 className="text-lg font-semibold mb-4">✅ Sitemap 生成结果</h2>
                    {sitemapResult.success ? (
                      <div className="space-y-3 text-sm">
                        <p className="text-green-300">{sitemapResult.message}</p>
                        <p className="text-zinc-400">生成时间: <span className="text-white">{new Date(sitemapResult.timestamp).toLocaleString()}</span></p>
                        <p className="text-zinc-400">房间数: <span className="text-white">{sitemapResult.roomCount}</span></p>
                        <details className="text-zinc-400">
                          <summary className="cursor-pointer text-white hover:text-cyan-300">预览 Sitemap XML</summary>
                          <pre className="mt-2 bg-black/40 p-3 rounded text-xs overflow-auto max-h-[200px]">
                            {sitemapResult.sitemapPreview}
                          </pre>
                        </details>
                      </div>
                    ) : (
                      <p className="text-red-300">❌ 错误: {sitemapResult.error}</p>
                    )}
                  </div>
                )}

                {/* 预览卡片 */}
                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-6">
                  <h2 className="text-lg font-semibold mb-4">📱 预览 (Google Search)</h2>
                  <div className="bg-white text-black p-4 rounded-lg space-y-1">
                    <div className="text-sm text-blue-600 font-semibold">https://chatsphere.live</div>
                    <div className="text-xl font-semibold text-black">{seoTitle}</div>
                    <div className="text-sm text-gray-700">{seoDescription}</div>
                  </div>
                </div>
              </>
            )}

            {section === 'blog' && (
              <>
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Blog Management</h1>
                <p className="text-zinc-400 mt-1">Create, edit, and manage blog posts</p>

                {/* 创建/编辑博客表单 */}
                {showCreateBlog && (
                  <Card className="mt-6 p-6">
                    <h2 className="text-lg font-semibold mb-4">{editingBlog ? '编辑博客' : '创建新博客'}</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">标题</label>
                        <input
                          type="text"
                          value={newBlogTitle}
                          onChange={(e) => setNewBlogTitle(e.target.value)}
                          placeholder="博客标题"
                          className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">URL 别名 (Slug)</label>
                        <input
                          type="text"
                          value={newBlogSlug}
                          onChange={(e) => setNewBlogSlug(e.target.value)}
                          placeholder="url-slug (例: welcome-to-chatsphere)"
                          className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">摘要</label>
                        <input
                          type="text"
                          value={newBlogExcerpt}
                          onChange={(e) => setNewBlogExcerpt(e.target.value)}
                          placeholder="简短的摘要 (可选)"
                          className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">内容</label>
                        <textarea
                          value={newBlogContent}
                          onChange={(e) => setNewBlogContent(e.target.value)}
                          placeholder="博客内容 (支持 Markdown)"
                          className="w-full min-h-[300px] px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10 focus:border-white/30 transition-all outline-none resize-none font-mono text-sm"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleSaveBlog}
                          disabled={blogSaving}
                          className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50"
                        >
                          {blogSaving ? '保存中...' : editingBlog ? '💾 更新博客' : '✨ 创建博客'}
                        </button>
                        <button
                          onClick={handleCancelBlog}
                          className="px-6 py-3 rounded-xl font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* 博客列表 */}
                <div className="mt-6 flex gap-3 items-center">
                  <button
                    onClick={() => setShowCreateBlog(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all text-white font-semibold"
                  >
                    <Plus className="h-4 w-4" /> 新建博客
                  </button>
                  <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                    <Search className="h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      value={blogSearch}
                      onChange={(e) => setBlogSearch(e.target.value)}
                      placeholder="搜索博客..."
                      className="bg-transparent outline-none text-sm w-full text-white"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {blogs
                    .filter(b => b.title.toLowerCase().includes(blogSearch.toLowerCase()))
                    .map((blog) => (
                      <Card key={blog.id} className="p-4 hover:bg-white/10 transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">{blog.title}</h3>
                            <p className="text-sm text-zinc-400 mb-2">{blog.excerpt || blog.content.substring(0, 100)}</p>
                            <div className="flex gap-4 text-xs text-zinc-500">
                              <span>📅 {new Date((blog.createdAt?.seconds || 0) * 1000).toLocaleDateString()}</span>
                              <span>🔗 /{blog.slug}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4 flex-shrink-0">
                            <button
                              onClick={() => handleEditBlog(blog)}
                              className="p-2 rounded-lg bg-white/10 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 transition-all"
                              title="编辑"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBlog(blog.id, blog.title)}
                              className="p-2 rounded-lg bg-white/10 hover:bg-red-500/30 text-red-300 hover:text-red-200 transition-all"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}

                  {blogs.filter(b => b.title.toLowerCase().includes(blogSearch.toLowerCase())).length === 0 && (
                    <div className="text-center py-12 text-zinc-400">
                      <p>暂无博客文章</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
