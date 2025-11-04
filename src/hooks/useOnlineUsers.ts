import { useEffect, useState, useMemo } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { db } from '@/firebase';
import { auth } from '@/firebase';
import { useServerTime } from './useServerTime';

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
 * 使用 Firebase 服务器时间进行 5 分钟过滤，避免设备时间不同步
 */
export function useOnlineUsers() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const serverNow = useServerTime(); // 使用 Firebase 服务器时间
  
  const currentUid = auth.currentUser?.uid;
  const currentDevice = typeof navigator !== 'undefined' 
    ? /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) 
      ? 'mobile' 
      : 'desktop'
    : 'unknown';
  
  console.log(`[useOnlineUsers] ★ Component rendered [${currentDevice}], current users: ${users.length}, serverNow: ${serverNow}`);

  useEffect(() => {
    if (!db) {
      console.error(`[useOnlineUsers] ★★ CRITICAL: db is NULL!`);
      setLoading(false);
      return;
    }
    
    const presenceRef = ref(db, 'presence');
    
    let callCount = 0;
    const unsubscribe = onValue(
      presenceRef, 
      async (snap) => {
        callCount++;
        console.log(`[useOnlineUsers] ★★ onValue triggered #${callCount}, serverNow=${serverNow}`);
        
        try {
          const presenceVal = snap.val() || {};
          const totalPresence = Object.keys(presenceVal).length;
          
          console.log(`[useOnlineUsers] ★★ Total presence entries: ${totalPresence}`);

          // 5 分钟阈值
          const FIVE_MIN = 5 * 60 * 1000;
          
          // 使用 Firebase 服务器时间进行过滤
          // 如果 serverNow 还没准备好，先不过滤
          let onlineUids: string[] = [];
          
          if (serverNow === null) {
            // Server time not ready yet, show all online=true users as fallback
            console.log(`[useOnlineUsers] ★★ serverNow is null, using state='online' as fallback`);
            onlineUids = Object.entries(presenceVal)
              .filter(([uid, data]: any) => data?.state === 'online')
              .map(([uid]) => uid);
          } else {
            // Server time ready, apply 5-minute filter
            onlineUids = Object.entries(presenceVal)
              .filter(([uid, data]: any) => {
                const state = data?.state;
                const lastSeen = data?.lastSeen;
                
                if (state !== 'online') return false;
                if (!lastSeen) return false;
                
                const delta = serverNow - lastSeen;
                const isRecent = delta >= 0 && delta <= FIVE_MIN;
                
                return isRecent;
              })
              .map(([uid]) => uid);
            
            console.log(`[useOnlineUsers] ★★ Filtered with server time: ${presenceVal.length} total → ${onlineUids.length} recent`);
          }

          if (onlineUids.length === 0) {
            console.log(`[useOnlineUsers] ★★ No online users found`);
            setUsers([]);
            setLoading(false);
            return;
          }

          // 拉取 profiles
          const profilesSnap = await get(ref(db, 'profiles'));
          const profilesVal = profilesSnap.val() || {};

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

          console.log(`[useOnlineUsers] ★★ Final filtered list: ${list.length} users`);
          setUsers(list);
          setLoading(false);
        } catch (err) {
          console.error(`[useOnlineUsers] ★★ ERROR:`, err);
          setLoading(false);
        }
      }, 
      (error) => {
        console.error(`[useOnlineUsers] ★★ Firebase error:`, error);
      }
    );

    return () => unsubscribe();
  }, [serverNow]); // Re-run when serverNow changes

  return { users, loading };
}

/**
 * 过滤式 Hook - 用于进行性别过滤等二次处理
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

    console.log(`[useFilteredOnlineUsers] [${currentDevice}] Input: ${users.length}, After gender filter (${genderFilter}): ${filtered.length}`);
    return filtered;
  }, [users, genderFilter, currentUid, currentDevice]);
}
