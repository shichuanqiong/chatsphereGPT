// src/pages/Login.tsx
import GlassCard from '../components/GlassCard';
import ResetPasswordModal from '../components/auth/ResetPasswordModal';
import { auth, db, presenceOnline } from '../firebase';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { ref, set, serverTimestamp, runTransaction, remove, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { ensureProfile } from '../lib/profileService';

export default function Login() {
  const nav = useNavigate();
  const { show } = useToast();

  // Reset password modal state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    document.documentElement.removeAttribute('data-sidebar');
    // Detect mobile
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      document.documentElement.removeAttribute('data-sidebar');
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // 快捷键监听：Ctrl+Shift+A 打开 Admin 登录
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAdminLogin(true);
        setAdminUsername('');
        setAdminPassword('');
      }
      // ESC 关闭 Admin 登录窗口
      if (e.key === 'Escape' && showAdminLogin) {
        setShowAdminLogin(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminLogin]);

  // Admin 登录验证
  const handleAdminLogin = async () => {
    if (adminLoggingIn) return;
    setAdminLoggingIn(true);
    try {
      const ADMIN_USERNAME = 'admin';
      const ADMIN_PASSWORD = 'Chatadmin2025$';

      if (adminUsername === ADMIN_USERNAME && adminPassword === ADMIN_PASSWORD) {
        show('✅ Admin 登录成功！', 'success');
        localStorage.setItem('adminToken', 'logged_in');
        setShowAdminLogin(false);
        setTimeout(() => nav('/admin'), 500);
      } else {
        show('❌ Admin 用户名或密码错误', 'error');
        setAdminPassword('');
      }
    } finally {
      setAdminLoggingIn(false);
    }
  };

  const COUNTRY_OPTIONS = [
    'United States',
    'Canada',
    'United Kingdom',
    'Australia',
    'New Zealand',
    'Singapore',
    'Hong Kong',
    'Taiwan',
    'China',
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
  const [nickname, setNickname] = useState('');
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

      // 2) 缓存基础资料（按uid分桶，仅用于预填，不用于显示）
      const profileCache = {
        name: normalizedNickname,
        ageGroup: normalizedAge,
        gender,
        country: normalizedCountry,
        v: 1
      };
      try { localStorage.setItem(`cs.profile.${user.uid}`, JSON.stringify(profileCache)); } catch {}
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
        await ensureProfile(user.uid);
      } catch (e) {
        console.warn('ensure profile failed:', e);
      }

      // 4.5) 设置 admin 角色（用于 analytics 权限）
      // 硬编码 admin 邮箱
      const ADMIN_EMAIL = 'patx2024@gmail.com';
      if (user.email === ADMIN_EMAIL) {
        try {
          await set(ref(db, `roles/${user.uid}/admin`), true);
          console.log('[Login] Admin role set for', user.email);
        } catch (e) {
          console.warn('Failed to set admin role:', e);
        }
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

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile) {
                        setShowResetPassword(true);
                      } else {
                        const resetEmail = prompt('Enter your email address for password reset:');
                        if (resetEmail) {
                          sendPasswordResetEmail(auth, resetEmail).then(() => {
                            show('Password reset email sent. Please check your inbox.', 'success', 2000);
                          }).catch((err: any) => {
                            show(`Error: ${err.message || 'Failed to send reset email'}`, 'error', 2000);
                          });
                        }
                      }
                    }}
                    className="text-white/60 hover:text-white text-xs transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

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
            <button
              onClick={() => setShowPrivacyPolicy(true)}
              className="hover:text-white transition-colors cursor-pointer bg-none border-none p-0"
            >
              Terms & Privacy Policy
            </button>
            <span className="mx-1 text-white/30">·</span>
            <span className="hover:text-white transition-colors cursor-pointer">Contact Us</span>
            <span className="mx-1 text-white/30">·</span>
            <a className="hover:text-white transition-colors" href="/chatsphereGPT/#/blog">Blog</a>
          </div>
          <div className="text-xs text-white/45">Background by Unsplash & Picsum</div>
          <div className="text-xs text-white/40">© 2025 ChatSphere</div>
        </div>
      </GlassCard>

      {/* Privacy Policy 弹窗 */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-fade-in">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">🔒 Privacy Policy</h2>
                <button
                  onClick={() => setShowPrivacyPolicy(false)}
                  className="text-white/60 hover:text-white text-2xl transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="text-white/80 space-y-4 text-sm leading-relaxed">
                <p><strong>Last Updated: October 31, 2025</strong></p>
                <p>ChatSphere values your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you use our services.</p>

                <div>
                  <h3 className="text-cyan-300 font-semibold mb-2">1. Information We Collect</h3>
                  <p className="text-white/70">We may collect the following types of information:</p>
                  <ul className="list-disc list-inside text-white/70 space-y-1 ml-2">
                    <li><strong>Account Information:</strong> Email, username, encrypted password.</li>
                    <li><strong>Guest Information:</strong> Temporary nickname, country or region (for localization).</li>
                    <li><strong>Chat and Interaction Data:</strong> Messages and activity logs (temporarily stored for chat functionality).</li>
                    <li><strong>Technical Data:</strong> Browser type, device information, IP address, and system logs for security and performance optimization.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-cyan-300 font-semibold mb-2">2. How We Use Your Information</h3>
                  <p className="text-white/70">We use the collected information to:</p>
                  <ul className="list-disc list-inside text-white/70 space-y-1 ml-2">
                    <li>Authenticate users and manage accounts.</li>
                    <li>Operate and improve the ChatSphere platform.</li>
                    <li>Detect and prevent fraud, abuse, or security risks.</li>
                    <li>Analyze usage trends and enhance user experience.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-cyan-300 font-semibold mb-2">3. Data Protection</h3>
                  <ul className="list-disc list-inside text-white/70 space-y-1 ml-2">
                    <li>All data transmissions are encrypted via HTTPS.</li>
                    <li>Authentication and data storage are secured using Firebase Authentication and Realtime Database security rules.</li>
                    <li>Passwords are never stored in plain text.</li>
                    <li>Access to sensitive data is restricted to authorized system administrators.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-cyan-300 font-semibold mb-2">4. Data Retention and Deletion</h3>
                  <ul className="list-disc list-inside text-white/70 space-y-1 ml-2">
                    <li>Registered users may request account deletion at any time.</li>
                    <li>Guest session data is automatically deleted after a short retention period.</li>
                    <li>Some logs may be temporarily retained for security or debugging purposes.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-cyan-300 font-semibold mb-2">5. Third-Party Services</h3>
                  <p className="text-white/70">ChatSphere uses third-party providers (such as Firebase, Google Analytics, and related APIs). These services may collect usage information independently and are governed by their own privacy policies.</p>
                </div>

                <div>
                  <h3 className="text-cyan-300 font-semibold mb-2">6. Children's Privacy</h3>
                  <p className="text-white/70">ChatSphere is not intended for individuals under the age of 13. If we become aware that a child has registered, we will promptly delete the related account and data.</p>
                </div>

                <div>
                  <h3 className="text-cyan-300 font-semibold mb-2">7. Changes to This Policy</h3>
                  <p className="text-white/70">We may update this Privacy Policy from time to time. Any significant changes will be announced on the website or through user notifications.</p>
                </div>

                <div>
                  <h3 className="text-cyan-300 font-semibold mb-2">8. Contact Us</h3>
                  <p className="text-white/70">If you have any questions or concerns regarding your privacy, please contact us at:</p>
                  <p className="text-white/70"><strong>📧 chatspherelive@gmail.com</strong></p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowPrivacyPolicy(false)}
                  className="px-6 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin 登录弹窗 */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 p-8 w-96 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">🛡️ Admin Login</h2>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all placeholder-white/50 focus:outline-none"
                autoFocus
                disabled={adminLoggingIn}
              />
              <input
                type="password"
                placeholder="Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-white/40 transition-all placeholder-white/50 focus:outline-none"
                disabled={adminLoggingIn}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAdminLogin}
                disabled={adminLoggingIn}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adminLoggingIn ? '登录中...' : 'Login'}
              </button>
              <button
                onClick={() => setShowAdminLogin(false)}
                disabled={adminLoggingIn}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-white/50 text-center mt-4">Press ESC to close</p>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <ResetPasswordModal
          open={showResetPassword}
          onClose={() => setShowResetPassword(false)}
        />
      )}
    </main>
  );
}
