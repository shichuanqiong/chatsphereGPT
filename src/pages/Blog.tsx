import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import BackgroundRotator from '../components/BackgroundRotator';
import GlassCard from '../components/GlassCard';
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

  return (
    <main className="min-h-screen text-white">
      <BackgroundRotator />
      <div className="max-w-3xl mx-auto pt-20 px-4">
        <GlassCard className="p-6">
          <h1 className="text-3xl font-bold">Blog</h1>
          <p className="text-white/70">Photography · Music · Travel · Sports · Food</p>
          <div className="mt-4 divide-y divide-white/10">
            {posts.map(p => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="block py-3 hover:opacity-90"
              >
                <div className="text-xl">{p.title}</div>
                <div className="text-white/60 text-sm">{p.excerpt}</div>
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
