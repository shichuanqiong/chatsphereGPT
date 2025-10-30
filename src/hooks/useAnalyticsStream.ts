import { useEffect, useState } from 'react';
import { AdminAPI } from '@/lib/api';

export type AnalyticsSnapshot = {
  online: number;
  msg24h: number;
  dau: number;
  buckets?: Array<{ h: number; c: number }>;
  topRooms?: Array<{ name: string; count: number }>;
};

export function useAnalyticsStream() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;

    const fetchMetrics = async () => {
      try {
        // 获取 summary（核心指标）
        const summary = await AdminAPI.summary();
        
        // 获取 24h buckets（消息分桶）
        const bucketsData = await AdminAPI.buckets();
        
        // 获取 top rooms（热门房间）
        const roomsData = await AdminAPI.topRooms();

        if (mounted) {
          // 转换 buckets 数据为时间序列
          const points = (bucketsData.buckets || []).map((b: any) => ({
            t: `${String(b.h).padStart(2, '0')}:00`,
            v: b.c || 0,
          }));

          setData({
            online: summary.online || 0,
            msg24h: summary.msg24h || 0,
            dau: summary.dau || 0,
            buckets: bucketsData.buckets || [],
            topRooms: roomsData.rooms || [],
          });
          setConnected(true);
          setError(null);
        }
      } catch (err: any) {
        console.error('[useAnalyticsStream] Error fetching metrics:', err);
        if (mounted) {
          setConnected(false);
          setError(err.message || 'Failed to fetch metrics');
        }
      }
    };

    // 立即获取一次
    fetchMetrics();

    // 每 30 秒刷新一次
    refreshInterval = setInterval(fetchMetrics, 30000);

    return () => {
      mounted = false;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, []);

  return { data, connected, error };
}

/**
 * Hook for fetching users list
 */
export function useAdminUsers() {
  const [users, setUsers] = useState<Array<{
    uid: string;
    name: string;
    email: string;
    status: string;
    messageCount: number;
  }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const data = await AdminAPI.users();
        if (mounted) {
          setUsers(data.users);
          setError(null);
        }
      } catch (err: any) {
        console.error('[useAdminUsers] Error:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch users');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUsers();
    refreshInterval = setInterval(fetchUsers, 60000); // 每 60 秒刷新一次

    return () => {
      mounted = false;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [refreshTrigger]);

  return { 
    users, 
    loading, 
    error,
    refetch: () => setRefreshTrigger(prev => prev + 1)
  };
}

/**
 * Hook for fetching rooms list
 */
export function useAdminRooms() {
  const [rooms, setRooms] = useState<Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    memberCount: number;
    messageCount: number;
  }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;

    const fetchRooms = async () => {
      try {
        setLoading(true);
        const data = await AdminAPI.rooms();
        if (mounted) {
          setRooms(data.rooms);
          setError(null);
        }
      } catch (err: any) {
        console.error('[useAdminRooms] Error:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch rooms');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRooms();
    refreshInterval = setInterval(fetchRooms, 60000); // 每 60 秒刷新一次

    return () => {
      mounted = false;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, []);

  return { rooms, loading, error };
}

/**
 * Hook for fetching moderation reports
 */
export function useAdminReports() {
  const [reports, setReports] = useState<Array<{
    id: string;
    userId: string;
    userName: string;
    reason: string;
    status: 'pending' | 'resolved' | 'rejected';
    createdAt: number;
    resolvedAt?: number;
    resolvedBy?: string;
    description: string;
  }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;

    const fetchReports = async () => {
      try {
        setLoading(true);
        const data = await AdminAPI.reports();
        if (mounted) {
          setReports(data.reports);
          setError(null);
        }
      } catch (err: any) {
        console.error('[useAdminReports] Error:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch reports');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchReports();
    refreshInterval = setInterval(fetchReports, 30000); // 每 30 秒刷新一次

    return () => {
      mounted = false;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, []);

  return { reports, loading, error };
}
