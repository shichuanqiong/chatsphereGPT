// src/auth.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

type AuthContextType = {
  user: any | null;
  loading: boolean;
};

const AuthCtx = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: any }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // ★ 刷新后恢复全局/本地 uid，供其它模块兜底读取
      if (u?.uid) {
        (window as any)._uid = u.uid;
        try { localStorage.setItem('uid', u.uid); } catch {}
      }
    });
    return () => off();
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
