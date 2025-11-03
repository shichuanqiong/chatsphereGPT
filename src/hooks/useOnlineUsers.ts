import { useMemo } from 'react';

export interface OnlineUser {
  uid: string;
  state?: 'online' | 'offline';
  lastSeen?: number;
  gender?: string;
  nickname?: string;
  displayName?: string;
  age?: number;
  country?: string;
  isGuest?: boolean;
  [key: string]: any;
}

/**
 * 共享过滤逻辑：计算在线用户列表
 * 
 * 核心特性：
 * - 从提供的 presence 对象中过滤在线用户
 * - 合并对应的 profile 数据（性别、昵称等）
 * - 自动过滤 5 分钟内活跃的用户（防止显示陈旧状态）
 * - 排除当前用户自己
 * - 支持性别过滤（all/male/female）
 * - Desktop (Home.tsx) 和 Mobile (Sidebar.tsx) 都使用这个逻辑
 * 
 * 用法：
 * const onlineUsers = useOnlineUsersList(presence, profiles, genderFilter, currentUid);
 * 
 * @param presence - /presence 数据对象
 * @param profiles - /profiles 数据对象
 * @param genderFilter - 性别过滤：'all' | 'male' | 'female'
 * @param currentUid - 当前用户 UID（用于排除自己）
 * @returns 过滤后的在线用户数组
 */
export function useOnlineUsersList(
  presence: Record<string, any> = {},
  profiles: Record<string, any> = {},
  genderFilter: 'all' | 'male' | 'female' = 'all',
  currentUid: string = ''
): OnlineUser[] {
  return useMemo(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 分钟超时

    const users = Object.keys(presence)
      .filter((k) => {
        // ★ 核心过滤逻辑：
        // 1. state === 'online'
        // 2. lastSeen 在 5 分钟内（防止显示陈旧数据）
        // 3. 排除当前用户
        const lastSeen = presence[k]?.lastSeen ?? 0;
        const isActive =
          presence[k]?.state === 'online' && now - lastSeen < timeout && k !== currentUid;
        return isActive;
      })
      .map((k) => ({
        uid: k,
        state: presence[k]?.state,
        lastSeen: presence[k]?.lastSeen,
        // 合并 profile 数据（性别、昵称等）
        ...(profiles[k] || {}),
      }))
      .filter(Boolean);

    // 应用性别过滤
    if (genderFilter === 'all') {
      return users;
    }
    return users.filter((u) => u.gender === genderFilter);
  }, [presence, profiles, genderFilter, currentUid]);
}

/**
 * 计算在线用户数量（不含性别过滤）
 * 用于显示 "Online: X users"
 */
export function useOnlineCount(presence: Record<string, any> = {}, currentUid: string = ''): number {
  return useMemo(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000;

    return Object.keys(presence).filter((k) => {
      const lastSeen = presence[k]?.lastSeen ?? 0;
      return presence[k]?.state === 'online' && now - lastSeen < timeout && k !== currentUid;
    }).length;
  }, [presence, currentUid]);
}

// 向后兼容：保留旧的 hook 名称
export const useOnlineUsers = useOnlineUsersList;
