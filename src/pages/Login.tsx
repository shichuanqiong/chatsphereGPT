// src/pages/Login.tsx
import RotatingBWBackground from '../components/RotatingBWBackground';
import GlassCard from '../components/GlassCard';
import { auth, db, presenceOnline } from '../firebase';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { ref, set, serverTimestamp } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useToast } from '../components/Toast';

export default function Login() {
  const nav = useNavigate();
  const { show } = useToast();

  // 基本资料（登录页也要收集）
  const [mode, setMode] = useState<'guest' | 'register' | 'login'>('guest');
  const [nickname, setNickname] = useState(localStorage.getItem('nickname') || '');
  const [gender, setGender] = useState<'male' | 'female'>(
    (localStorage.getItem('gender') as 'male' | 'female') || 'male'
  );
  const [age, setAge] = useState(localStorage.getItem('age') || '');
  const [country, setCountry] = useState(localStorage.getItem('country') || '');

  // 仅注册/登录需要
  const [email, setEmail] = useState(localStorage.getItem('email') || '');
  const [password, setPassword] = useState(localStorage.getItem('password') || '');

  // ---- 统一的登录后处理：先导航，后写库；把 uid 稳定存好 ----
  const afterLogin = async (user: any, isGuest: boolean) => {
    try {
      // 1) 先缓存 uid（刷新/新标签页都能取到）
      (window as any)._uid = user.uid;
      try { localStorage.setItem('uid', user.uid); } catch {}

      // 2) 缓存基础资料（回填用）
      localStorage.setItem('nickname', nickname);
      localStorage.setItem('gender', gender);
      localStorage.setItem('age', age);
      localStorage.setItem('country', country);
      if (!isGuest) {
        localStorage.setItem('email', email);
        localStorage.setItem('password', password);
      }

      // 3) 先导航，避免写库失败卡在登录页
      nav('/home');

      // 4) 后台写入用户档案（失败只告警，不阻塞）
      try {
        await set(ref(db, `/profiles/${user.uid}`), {
          uid: user.uid,
          nickname,
          gender,
          age: Number(age),
          country,
          isGuest,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('write profile failed:', e);
      }

      // 5) 在线心跳（失败也不阻塞）
      try { presenceOnline(user.uid); } catch {}
    } catch (e) {
      show('Login failed, please retry.', 'error', 1400);
      console.error(e);
    }
  };

  const ensureProfileFilled = () => {
    if (!nickname || !gender || !age || !country) {
      show('Please fill nickname, gender, age, and country.', 'warning', 1400);
      return false;
    }
    return true;
  };

  const doGuest = async () => {
    if (!ensureProfileFilled()) return;
    const { user } = await signInAnonymously(auth);
    if (nickname) await updateProfile(user, { displayName: nickname });
    await afterLogin(user, true);
  };

  const doRegister = async () => {
    if (!ensureProfileFilled()) return;
    if (!email || !password) {
      show('Email & password required for register.', 'warning', 1400);
      return;
    }
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (nickname) await updateProfile(user, { displayName: nickname });
      await afterLogin(user, false);
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        const goLogin = confirm('This email is already registered. Go to Login?');
        if (goLogin) {
          setMode('login');
        } else {
          const reset = confirm('Send a password reset email to this address?');
          if (reset) {
            try {
              await sendPasswordResetEmail(auth, email);
              show('Password reset email sent. Please check your inbox.', 'success', 1400);
            } catch (err) {
              show('Failed to send reset email.', 'error', 1400);
              console.error(err);
            }
          }
        }
      } else {
        show(`Register failed: ${e?.message || e}`, 'error', 1400);
        console.error(e);
      }
    }
  };

  const doLogin = async () => {
    if (!email || !password) {
      show('Email & password required.', 'warning', 1400);
      return;
    }
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      if (nickname) await updateProfile(user, { displayName: nickname });
      await afterLogin(user, false);
    } catch (e: any) {
      show(`Login failed: ${e?.message || e}`, 'error', 1400);
      console.error(e);
    }
  };

  const forgotPassword = async () => {
    if (!email) {
      show('Enter your email first.', 'warning', 1400);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      show('Password reset email sent.', 'success', 1400);
    } catch (e) {
      show('Failed to send reset email.', 'error', 1400);
      console.error(e);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center text-white">
      <RotatingBWBackground />
      <GlassCard className="w-[560px] p-8 animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-teal-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ChatSphere
          </h1>
          <p className="text-white/70 text-center mt-3 text-lg">Real-time Social Chat Community</p>
        </div>

        {/* 基本资料 */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname"
            className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as 'male' | 'female')}
            className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15 cursor-pointer"
          >
            <option value="male">male</option>
            <option value="female">female</option>
          </select>
          <input
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Age"
            className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
          />
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country (e.g., USA)"
            className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
          />
        </div>

        {/* 模式切换 */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-xl transition-all duration-200 ${mode === 'login' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-white/10 hover:bg-white/15'}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-xl transition-all duration-200 ${mode === 'register' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-white/10 hover:bg-white/15'}`}
          >
            Register
          </button>
          <button
            onClick={() => setMode('guest')}
            className={`flex-1 py-2.5 rounded-xl transition-all duration-200 ${mode === 'guest' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'bg-white/10 hover:bg-white/15'}`}
          >
            Guest
          </button>
        </div>

        {/* 邮箱/密码（登录或注册时显示） */}
        {mode !== 'guest' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
            />
          </div>
        )}

        {/* 主按钮 */}
        <div className="mt-4">
          {mode === 'login' && (
            <div className="space-y-2">
              <button
                onClick={doLogin}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Login
              </button>
              <button onClick={forgotPassword} className="w-full text-sm text-white/70 hover:text-white transition-colors">
                Forgot password?
              </button>
            </div>
          )}
          {mode === 'register' && (
            <button
              onClick={doRegister}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Create Account
            </button>
          )}
          {mode === 'guest' && (
            <button
              onClick={doGuest}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Chat as Guest
            </button>
          )}
        </div>

        {/* 页脚链接（首页入口保留 Blog） */}
        <div className="mt-6 text-center text-white/60 text-sm">
          <span className="hover:text-white transition-colors cursor-pointer">Terms & Privacy Policy</span> · <span className="hover:text-white transition-colors cursor-pointer">Contact Us</span> ·{' '}
          <a className="hover:text-white transition-colors" href="/blog">Blog</a>
        </div>
      </GlassCard>
    </main>
  );
}
