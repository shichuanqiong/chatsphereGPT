import { useEffect, useState, useMemo } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { db } from '@/firebase';
import { auth } from '@/firebase';

export interface OnlineUser {
  uid: string;
  state: 'online' | 'offline';
  lastSeen?: number;
  gender?: string;
  nickname?: string;
  isGuest?: boolean;
  country?: string;
  age?: number;
  displayName?: string;
  [key: string]: any;
}

// ★ 全局诊断对象，供手机端在 DevTools 中查看
(window as any).__TALKISPHERE_DEBUG__ = (window as any).__TALKISPHERE_DEBUG__ || {};
(window as any).__TALKISPHERE_DEBUG__.useOnlineUsers = {
  lastUpdate: new Date().toISOString(),
  presenceKeys: 0,
  onlineUids: [],
  profilesTotal: 0,
  finalList: [] as any[],
  error: null,
};

/**
 * ★ 统一的在线用户数据源 Hook
 * 
 * Desktop (Home.tsx) 和 Mobile (Sidebar.tsx) 都使用这个 Hook
 * 确保两端从相同的 Firebase 路径 (/presence + /profiles) 读取数据
 * 
 * 核心流程：
 * 1. 订阅 /presence 变化
 * 2. 当 presence 变化时，自动拉取对应的 /profiles 数据
 * 3. 合并 presence 和 profile 信息
 * 4. 返回在线用户列表
 */
export function useOnlineUsers() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  const currentUid = auth.currentUser?.uid;
  const currentDevice = typeof navigator !== 'undefined' 
    ? /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) 
      ? 'mobile' 
      : 'desktop'
    : 'unknown';
  
  console.log(`[useOnlineUsers] ★ Component rendered [${currentDevice}], current users: ${users.length}, uid: ${currentUid?.substring(0, 8) || 'none'}`);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    console.log(`[useOnlineUsers] ★★ Hook mounted [${currentDevice}], setting up subscription, uid: ${currentUid?.substring(0, 8) || 'NONE'}`);
    
    const presenceRef = ref(db, 'presence');
    
    let callCount = 0;
    
    const unsubscribe = onValue(presenceRef, async (snap) => {
      callCount++;
      try {
        const presenceVal = snap.val() || {};
        const totalPresence = Object.keys(presenceVal).length;
        
        console.log(`[useOnlineUsers] ★★ onValue callback #${callCount} [${currentDevice}]:`, {
          totalPresenceKeys: totalPresence,
          timestamp: new Date().toLocaleTimeString(),
          first3: Object.entries(presenceVal).slice(0, 3).map(([uid, data]: any) => ({
            uid: uid.substring(0, 8),
            state: (data as any)?.state,
            lastSeen: (data as any)?.lastSeen,
          })),
        });

        // ★ 更新全局诊断对象
        (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.lastUpdate = new Date().toISOString();
        (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.presenceKeys = totalPresence;

        // 过滤出在线用户
        const now = Date.now();
        const timeout = 5 * 60 * 1000;
        
        const onlineUids = Object.entries(presenceVal)
          .filter(([, data]: any) => {
            const state = data?.state;
            const lastSeen = data?.lastSeen ?? 0;
            const isActive = state === 'online' && (now - lastSeen < timeout);
            return isActive;
          })
          .map(([uid]) => uid);

        console.log(`[useOnlineUsers] ★★ After 5min timeout filter [${currentDevice}]:`, {
          onlineCount: onlineUids.length,
          onlineUids: onlineUids.slice(0, 5).map(u => u.substring(0, 8)),
        });

        // ★ 更新全局诊断对象
        (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.onlineUids = onlineUids.slice(0, 10).map(u => u.substring(0, 8));

        if (onlineUids.length === 0) {
          console.log(`[useOnlineUsers] ★★ No online users found [${currentDevice}], returning empty`);
          setUsers([]);
          setLoading(false);
          (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.finalList = [];
          return;
        }

        // 拉取 profiles
        console.log(`[useOnlineUsers] ★★ Fetching profiles for ${onlineUids.length} users [${currentDevice}]`);
        const profilesSnap = await get(ref(db, 'profiles'));
        const profilesVal = profilesSnap.val() || {};

        console.log(`[useOnlineUsers] ★★ Profiles received [${currentDevice}]:`, {
          totalProfiles: Object.keys(profilesVal).length,
        });

        // ★ 更新全局诊断对象
        (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.profilesTotal = Object.keys(profilesVal).length;

        // 合并数据
        const list: OnlineUser[] = onlineUids.map((uid) => {
          const profile = profilesVal[uid] || {};
          const presence = presenceVal[uid] || {};

          return {
            uid,
            state: presence.state ?? 'online',
            lastSeen: presence.lastSeen,
            gender: profile.gender,
            nickname: profile.nickname,
            isGuest: profile.isGuest,
            country: profile.country,
            age: profile.age,
            displayName: profile.displayName,
            ...profile,
          };
        });

        console.log(`[useOnlineUsers] ★★ Final list [${currentDevice}] (${list.length} users):`, 
          list.slice(0, 2).map(u => ({ uid: u.uid.substring(0, 8), nick: u.nickname }))
        );
        
        // ★ 更新全局诊断对象
        (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.finalList = list.slice(0, 5).map(u => ({
          uid: u.uid.substring(0, 8),
          nick: u.nickname,
          gender: u.gender,
        }));
        (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.error = null;

        setUsers(list);
        setLoading(false);
      } catch (err) {
        console.error(`[useOnlineUsers] ★★ ERROR [${currentDevice}]:`, err);
        (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.error = String(err);
        setLoading(false);
      }
    }, (error) => {
      console.error(`[useOnlineUsers] ★★ Firebase subscription error [${currentDevice}]:`, error);
      (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.error = `Firebase subscription error: ${String(error)}`;
    });

    return () => {
      console.log(`[useOnlineUsers] ★★ Hook unmounting [${currentDevice}], unsubscribe called`);
      unsubscribe();
    };
  }, [currentDevice]);

  return { users, loading };
}

/**
 * 过滤式 Hook - 用于进行性别过滤等二次处理
 * 接收 users 数组和过滤条件，返回过滤后的结果
 */
export function useFilteredOnlineUsers(
  users: OnlineUser[] = [],
  genderFilter: 'all' | 'male' | 'female' = 'all',
  currentUid: string = ''
): OnlineUser[] {
  const currentDevice = typeof navigator !== 'undefined' 
    ? /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) 
      ? 'mobile' 
      : 'desktop'
    : 'unknown';

  return useMemo(() => {
    let filtered = users.filter((u) => u.uid !== currentUid);

    if (genderFilter !== 'all') {
      filtered = filtered.filter((u) => u.gender === genderFilter);
    }

    console.log(`[useFilteredOnlineUsers] [${currentDevice}] after gender filter (${genderFilter}):`, {
      input: users.length,
      output: filtered.length,
      currentUidExcluded: currentUid ? currentUid.substring(0, 8) : 'none',
    });

    return filtered;
  }, [users, genderFilter, currentUid, currentDevice]);
}
