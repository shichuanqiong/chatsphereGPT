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
  console.log(`[useOnlineUsers] ★ DB exists: ${!!db}, Auth exists: ${!!auth}`);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    console.log(`[useOnlineUsers] ★★ Hook mounted [${currentDevice}], setting up subscription, uid: ${currentUid?.substring(0, 8) || 'NONE'}`);
    console.log(`[useOnlineUsers] ★★ DB object:`, db ? 'EXISTS' : 'NULL', 'Auth object:', auth ? 'EXISTS' : 'NULL');
    
    if (!db) {
      console.error(`[useOnlineUsers] ★★ CRITICAL: db is NULL! Cannot set up listener`);
      (window as any).__TALKISPHERE_DEBUG__.useOnlineUsers.error = 'db is NULL';
      setLoading(false);
      return;
    }
    
    const presenceRef = ref(db, 'presence');
    console.log(`[useOnlineUsers] ★★ Presence ref created:`, presenceRef);
    console.log(`[useOnlineUsers] ★★ About to attach onValue listener to /presence`);
    
    let callCount = 0;
    let listenerAttached = false;
    
    const unsubscribe = onValue(
      presenceRef, 
      async (snap) => {
        listenerAttached = true;
        callCount++;
        console.log(`[useOnlineUsers] ★★ ✅ onValue callback triggered! #${callCount}`);
        try {
          console.log(`[useOnlineUsers] ★★ snap.exists():`, snap.exists());
          console.log(`[useOnlineUsers] ★★ snap.val():`, snap.val());
          
          const presenceVal = snap.val() || {};
          const totalPresence = Object.keys(presenceVal).length;
          
          console.log(`[useOnlineUsers] ★★ Total presence entries: ${totalPresence}`);
          console.log(`[useOnlineUsers] ★★ presenceVal keys:`, Object.keys(presenceVal).slice(0, 5));
          
          // 过滤出在线用户
          const onlineUids = Object.entries(presenceVal)
            .filter(([uid, data]: any) => {
              const state = data?.state;
              const lastSeen = data?.lastSeen;
              
              // ★ 关键修复：检查 state === 'online' 且 lastSeen 在 5 分钟内
              if (state !== 'online') return false;
              
              // 如果没有 lastSeen，认为离线
              if (!lastSeen) return false;
              
              const now = Date.now();
              const timeout = 5 * 60 * 1000; // 5 分钟
              const isRecent = now - lastSeen < timeout;
              
              if (!isRecent) {
                console.log(`[useOnlineUsers] Filtered out ${uid.substring(0, 8)}: lastSeen=${lastSeen}, now=${now}, diff=${now - lastSeen}ms`);
              }
              
              return isRecent;
            })
            .map(([uid]) => uid);

          console.log(`[useOnlineUsers] ★★ Online after filter: ${onlineUids.length} users`);

          if (onlineUids.length === 0) {
            console.log(`[useOnlineUsers] ★★ No online users found, returning empty`);
            setUsers([]);
            setLoading(false);
            return;
          }

          // 拉取 profiles
          console.log(`[useOnlineUsers] ★★ Fetching profiles for ${onlineUids.length} users`);
          const profilesSnap = await get(ref(db, 'profiles'));
          const profilesVal = profilesSnap.val() || {};

          console.log(`[useOnlineUsers] ★★ Profiles count: ${Object.keys(profilesVal).length}`);

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

          console.log(`[useOnlineUsers] ★★ Final list: ${list.length} users`, list.slice(0, 3));
          setUsers(list);
          setLoading(false);
        } catch (err) {
          console.error(`[useOnlineUsers] ★★ ERROR in onValue callback:`, err);
          setLoading(false);
        }
      }, 
      (error) => {
        console.error(`[useOnlineUsers] ★★ Firebase onValue error:`, error);
        console.error(`[useOnlineUsers] ★★ Error code:`, error.code);
        console.error(`[useOnlineUsers] ★★ Error message:`, error.message);
      }
    );

    console.log(`[useOnlineUsers] ★★ Listener attachment complete. Will check if callback was triggered...`);

    return () => {
      console.log(`[useOnlineUsers] ★★ Cleanup: unsubscribe called`);
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
