// src/pages/Login.tsx
import RotatingBWBackground from '../components/RotatingBWBackground';
import GlassCard from '../components/GlassCard';
import { auth, db, presenceOnline } from '../firebase';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { ref, set, serverTimestamp, runTransaction, remove } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';

export default function Login() {
  const nav = useNavigate();
  const { show } = useToast();

  useEffect(() => {
    document.documentElement.removeAttribute('data-sidebar');
    return () => {
      document.documentElement.removeAttribute('data-sidebar');
    };
  }, []);

  const COUNTRY_OPTIONS = [
    'United States',
    'Canada',
    'United Kingdom',
    'Australia',
    'New Zealand',
    'Singapore',
    'Hong Kong',
    'Taiwan',
    'Japan',
    'South Korea',
    'Germany',
    'France',
    'Italy',
    'Spain',
    'Netherlands',
    'Sweden',
    'Norway',
    'Finland',
    'Mexico',
    'Brazil',
    'Argentina',
    'Chile',
    'India',
    'Philippines',
    'Malaysia',
    'Thailand',
  ];

  const [mode, setMode] = useState<'guest' | 'register' | 'login'>('login');
  const [nickname, setNickname] = useState(localStorage.getItem('nickname') || '');
  const storedGender = localStorage.getItem('gender');
  const [gender, setGender] = useState<'male' | 'female'>(storedGender === 'female' ? 'female' : 'male');
  const storedAge = localStorage.getItem('age');
  const [age, setAge] = useState(storedAge && storedAge.trim() !== '' ? storedAge : '18');
  const storedCountry = localStorage.getItem('country');
  const inferredCountry = storedCountry && COUNTRY_OPTIONS.includes(storedCountry) ? storedCountry : 'United States';
  const [country, setCountry] = useState(inferredCountry);

  const [email, setEmail] = useState(localStorage.getItem('email') || '');
  const [password, setPassword] = useState(localStorage.getItem('password') || '');

  // ---- 统一的登录后处理：先导航，后写库；把 uid 稳定存好 ----
  const reserveNickname = async (uid: string, nickname: string) => {
    const slug = nickname.toLowerCase();
    const indexRef = ref(db, `/nicknameIndex/${slug}`);
    const result = await runTransaction(indexRef, (current: any) => {
      if (!current || current.uid === uid) {
        return { uid };
      }
      return current;
    }, { applyLocally: false });

    if (!result.committed) {
      const err: any = new Error('nickname-taken');
      err.code = 'nickname-taken';
      throw err;
    }

    const snapshotVal = result.snapshot?.val();
    if (!snapshotVal || snapshotVal.uid !== uid) {
      const err: any = new Error('nickname-taken');
      err.code = 'nickname-taken';
      throw err;
    }

    return slug;
  };

  const afterLogin = async (
    user: any,
    {
      isGuest,
      normalizedNickname,
      normalizedAge,
      normalizedCountry,
      cleanupOnFailure,
      enforceUnique,
    }: {
      isGuest: boolean;
      normalizedNickname: string;
      normalizedAge: number;
      normalizedCountry: string;
      cleanupOnFailure: boolean;
      enforceUnique: boolean;
    }
  ) => {
    let reservedSlug: string | null = null;
    const cleanup = async () => {
      if (!cleanupOnFailure) return;
      try {
        await user.delete?.();
      } catch {}
      try {
        await auth.signOut();
      } catch {}
      if (reservedSlug) {
        try {
          await remove(ref(db, `/nicknameIndex/${reservedSlug}`));
        } catch {}
      }
    };

    try {
      if (enforceUnique) {
        reservedSlug = await reserveNickname(user.uid, normalizedNickname);
      }

      // 1) 先缓存 uid（刷新/新标签页都能取到）
      (window as any)._uid = user.uid;
      try { localStorage.setItem('uid', user.uid); } catch {}

      // 2) 缓存基础资料（回填用）
      localStorage.setItem('nickname', normalizedNickname);
      localStorage.setItem('gender', gender);
      localStorage.setItem('age', String(normalizedAge));
      localStorage.setItem('country', normalizedCountry);
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
          nickname: normalizedNickname,
          gender,
          age: normalizedAge,
          country: normalizedCountry,
          isGuest,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('write profile failed:', e);
      }

      // 5) 在线心跳（失败也不阻塞）
      try { presenceOnline(user.uid); } catch {}
      return true;
    } catch (e: any) {
      if (e?.code === 'nickname-taken') {
        show('This nickname is already in use. Please choose another.', 'warning', 2000);
      } else if (e?.message === 'nickname-check-failed') {
        console.error('nickname check failed', e?.original || e);
        show('Unable to validate nickname. Please try again.', 'error', 2000);
      } else {
        show('Login failed, please retry.', 'error', 1400);
        console.error(e);
      }
      await cleanup();
      return false;
    }
  };

  const ensureProfileValid = async ({ requireEmail }: { requireEmail?: boolean } = {}) => {
    const nameTrimmed = nickname.trim();
    if (!nameTrimmed) {
      show('Nickname is required.', 'warning', 1600);
      return null;
    }
    if (/\s/.test(nameTrimmed)) {
      show('Nickname cannot contain spaces.', 'warning', 1600);
      return null;
    }
    if (nameTrimmed.length > 16) {
      show('Nickname must be 16 characters or fewer.', 'warning', 1600);
      return null;
    }

    const ageNumber = Number(age);
    if (!Number.isInteger(ageNumber) || ageNumber < 13 || ageNumber > 120) {
      show('Age must be a whole number between 13 and 120.', 'warning', 1600);
      return null;
    }

    if (!country || !COUNTRY_OPTIONS.includes(country)) {
      show('Please select your country.', 'warning', 1600);
      return null;
    }

    if (requireEmail) {
      if (!email || !password) {
        show('Email address and password are required.', 'warning', 1600);
        return null;
      }
      const emailTrimmed = email.trim();
      setEmail(emailTrimmed);
      try {
        const methods = await fetchSignInMethodsForEmail(auth, emailTrimmed);
        if (methods.length > 0) {
          show('This email is already registered. Please log in instead.', 'warning', 1800);
          return null;
        }
      } catch (err) {
        console.error('email check failed', err);
        show('Unable to validate email. Please try again.', 'error', 1800);
        return null;
      }
    }

    setNickname(nameTrimmed);
    setAge(String(ageNumber));
    return { nameTrimmed, ageNumber, countrySelected: country };
  };

  const doGuest = async () => {
    const normalized = await ensureProfileValid();
    if (!normalized) return;
    try {
      const { user } = await signInAnonymously(auth);
      await updateProfile(user, { displayName: normalized.nameTrimmed });
      const success = await afterLogin(user, {
        isGuest: true,
        normalizedNickname: normalized.nameTrimmed,
        normalizedAge: normalized.ageNumber,
        normalizedCountry: normalized.countrySelected,
        cleanupOnFailure: true,
        enforceUnique: true,
      });
      if (!success) {
        setMode('guest');
      }
    } catch (err) {
      console.error('guest login failed', err);
      show('Guest login failed. Please try again.', 'error', 1800);
    }
  };

  const doRegister = async () => {
    const normalized = await ensureProfileValid({ requireEmail: true });
    if (!normalized) return;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(user, { displayName: normalized.nameTrimmed });
      const success = await afterLogin(user, {
        isGuest: false,
        normalizedNickname: normalized.nameTrimmed,
        normalizedAge: normalized.ageNumber,
        normalizedCountry: normalized.countrySelected,
        cleanupOnFailure: true,
        enforceUnique: true,
      });
      if (!success) {
        setMode('register');
      }
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        const goLogin = confirm('This email is already registered. Go to Login?');
        if (goLogin) {
          setMode('login');
        } else {
          const reset = confirm('Send a password reset email to this address?');
          if (reset) {
            try {
              // await sendPasswordResetEmail(auth, email); // This line was removed
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
      const emailTrimmed = email.trim();
      setEmail(emailTrimmed);
      const { user } = await signInWithEmailAndPassword(auth, emailTrimmed, password);
      const loginNicknameRaw = nickname || user.displayName || 'Guest';
      const loginNickname = loginNicknameRaw.trim() || 'Guest';
      await updateProfile(user, { displayName: loginNickname });
      const ageNumber = Number(age) >= 13 ? Number(age) : 18;
      const countryNormalized = COUNTRY_OPTIONS.includes(country) ? country : 'United States';
      const success = await afterLogin(user, {
        isGuest: false,
        normalizedNickname: loginNickname,
        normalizedAge: ageNumber,
        normalizedCountry: countryNormalized,
        cleanupOnFailure: false,
        enforceUnique: false,
      });
      if (!success) {
        setMode('login');
      }
    } catch (e: any) {
      show(`Login failed: ${e?.message || e}`, 'error', 1400);
      console.error(e);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center text-white">
      <RotatingBWBackground />
      <GlassCard className="w-[420px] p-8 animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-teal-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ChatSphere
          </h1>
          <p className="text-white/70 text-center mt-3 text-lg">Real-time Social Chat Community</p>
        </div>
        {(() => {
          if (mode === 'login') {
            return (
              <div className="space-y-6">
                <div className="space-y-3">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nickname"
                    className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
                  />
                </div>

                <button
                  onClick={doLogin}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Login
                </button>

                <div className="text-center text-white/65 text-sm">
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    Register
                  </button>
                  <span className="mx-2 text-white/30">•</span>
                  <button
                    type="button"
                    onClick={() => setMode('guest')}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    Chat as Guest
                  </button>
                </div>
              </div>
            );
          }

          if (mode === 'guest') {
            return (
              <div className="space-y-6">
                <div className="space-y-3">
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Nickname"
                    className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={13}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="Age"
                      className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
                    />
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                      className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15 cursor-pointer"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={doGuest}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Start Chatting
                </button>

                <div className="text-center text-white/65 text-sm">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    Login
                  </button>
                  <span className="mx-2 text-white/30">•</span>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    Register
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-6">
              <div className="space-y-3">
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nickname"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min={13}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Age"
                    className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15"
                  />
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                    className="px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15 cursor-pointer"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all duration-200 hover:bg-white/15 cursor-pointer"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c} className="text-black">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={doRegister}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Create Account
              </button>

              <div className="text-center text-white/65 text-sm">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Login
                </button>
                <span className="mx-2 text-white/30">•</span>
                <button
                  type="button"
                  onClick={() => setMode('guest')}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Chat as Guest
                </button>
              </div>
            </div>
          );
        })()}

        <div className="mt-6 text-center text-white/60 text-sm space-y-2">
          <div>
            <span className="hover:text-white transition-colors cursor-pointer">Terms & Privacy Policy</span>
            <span className="mx-1 text-white/30">·</span>
            <span className="hover:text-white transition-colors cursor-pointer">Contact Us</span>
            <span className="mx-1 text-white/30">·</span>
            <a className="hover:text-white transition-colors" href="/blog">Blog</a>
          </div>
          <div className="text-xs text-white/45">Background by Unsplash & Picsum</div>
          <div className="text-xs text-white/40">© 2025 ChatSphere</div>
        </div>
      </GlassCard>
    </main>
  );
}
