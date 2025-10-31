import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import GlassCard from '../components/GlassCard';
import Logo from '../components/Logo';
import { Link } from 'react-router-dom';

export default function Blog() {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(
    () =>
      onValue(ref(db, '/posts'), snap => {
        const v = snap.val() || {};
        const arr = Object.entries(v).map(([id, val]: any) => ({ id, ...val }));
        arr.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setPosts(arr);
      }),
    []
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const seconds = timestamp.seconds || timestamp;
    const date = new Date(seconds * 1000);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header with Logo & Brand */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Logo size={36} />
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
              ChatSphere
            </h1>
            <p className="text-xs text-white/50">Stories & Insights</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Center Column - Blog List */}
          <div className="lg:col-span-2">
            <GlassCard className="p-8">
              <div className="mb-8">
                <h2 className="text-4xl font-bold mb-2">Blog</h2>
                <p className="text-white/60">Photography · Music · Travel · Sports · Food</p>
              </div>

              <div className="space-y-4">
                {posts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-white/50">No posts yet. Check back soon!</p>
                  </div>
                ) : (
                  posts.map((p, idx) => (
                    <Link
                      key={p.id}
                      to={`/blog/${p.slug}`}
                      className="group block p-5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold group-hover:text-cyan-300 transition-colors line-clamp-2">
                            {p.title}
                          </h3>
                          <p className="text-white/60 text-sm mt-2 line-clamp-2">
                            {p.excerpt}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0 text-right">
                          <p className="text-xs text-white/50 whitespace-nowrap">
                            {formatDate(p.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </GlassCard>
          </div>

          {/* Right Sidebar - Blog Index */}
          <div className="lg:col-span-1">
            <GlassCard className="p-6 sticky top-24">
              <h3 className="text-lg font-bold mb-4 text-cyan-300">Latest Posts</h3>
              
              {posts.length === 0 ? (
                <p className="text-white/50 text-sm">No posts yet</p>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {posts.map((p) => (
                    <Link
                      key={p.id}
                      to={`/blog/${p.slug}`}
                      className="group block text-sm hover:opacity-100 opacity-70 transition-opacity"
                    >
                      <div className="text-white/90 group-hover:text-cyan-300 transition-colors font-medium line-clamp-2">
                        {p.title}
                      </div>
                      <div className="text-xs text-white/40 mt-1">
                        {formatDate(p.createdAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </main>
  );
}
