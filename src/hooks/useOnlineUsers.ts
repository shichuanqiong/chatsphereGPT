import { useEffect, useState, useMemo } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { db } from '@/firebase';

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

  useEffect(() => {
    const presenceRef = ref(db, 'presence');
    
    const unsubscribe = onValue(presenceRef, async (snap) => {
      try {
        const presenceVal = snap.val() || {};
        
        console.log('[useOnlineUsers] presence snapshot:', {
          totalKeys: Object.keys(presenceVal).length,
          sampleKeys: Object.keys(presenceVal).slice(0, 3),
        });

        // 过滤出在线用户 (state === 'online' AND lastSeen < 5分钟)
        const now = Date.now();
        const timeout = 5 * 60 * 1000; // 5分钟
        
        const onlineUids = Object.entries(presenceVal)
          .filter(([, data]: any) => {
            // ★ 修复：必须同时满足两个条件
            // 1. state === 'online'
            // 2. lastSeen 在 5 分钟内（防止显示陈旧的 state 值）
            const state = data?.state;
            const lastSeen = data?.lastSeen ?? 0;
            const isActive = state === 'online' && (now - lastSeen < timeout);
            return isActive;
          })
          .map(([uid]) => uid as string);

        console.log('[useOnlineUsers] online users count:', onlineUids.length);
        console.log('[useOnlineUsers] sample presence data:', {
          total: Object.keys(presenceVal).length,
          samples: Object.entries(presenceVal).slice(0, 5).map(([uid, data]: any) => {
            const now2 = Date.now();
            const lastSeen = data?.lastSeen ?? 0;
            const isActive = data?.state === 'online' && (now2 - lastSeen < timeout);
            return {
              uid: uid.slice(0, 8),
              state: data?.state,
              lastSeen: lastSeen > 0 ? `${Math.round((now2 - lastSeen) / 1000)}s ago` : 'N/A',
              isActive: isActive,
            };
          }),
          onlineCount: onlineUids.length,
        });

        if (onlineUids.length === 0) {
          console.log('[useOnlineUsers] no online users, returning empty array');
          setUsers([]);
          setLoading(false);
          return;
        }

        // 一次性拉取所有 profile 数据
        const profilesSnap = await get(ref(db, 'profiles'));
        const profilesVal = profilesSnap.val() || {};

        console.log('[useOnlineUsers] profiles snapshot:', {
          totalProfiles: Object.keys(profilesVal).length,
        });

        // 合并 presence + profile 数据
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
            ...profile, // 包含其他 profile 字段
          };
        });

        console.log('[useOnlineUsers] merged list:', {
          count: list.length,
          sample: list.slice(0, 2),
        });

        setUsers(list);
        setLoading(false);
      } catch (err) {
        console.error('[useOnlineUsers] Error fetching profiles:', err);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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
  return useMemo(() => {
    let filtered = users.filter((u) => u.uid !== currentUid);

    if (genderFilter !== 'all') {
      filtered = filtered.filter((u) => u.gender === genderFilter);
    }

    return filtered;
  }, [users, genderFilter, currentUid]);
}
