import { useEffect, useState } from 'react';

export type AnalyticsSnapshot = {
  online: number;
  msg24h: number;
  dau: number;
  points: Array<{ t: string; v: number }>;
};

export function useAnalyticsStream() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    try {
      const es = new EventSource('/api/admin/metrics/stream', { withCredentials: true });

      es.addEventListener('snapshot', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          setData(payload);
          setConnected(true);
        } catch (err) {
          console.error('Failed to parse event:', err);
        }
      });

      es.addEventListener('error', () => {
        setConnected(false);
        console.debug('Metrics stream error or closed (mock mode)');
      });

      return () => {
        es.close();
        setConnected(false);
      };
    } catch (e) {
      console.debug('EventSource not supported or error:', e);
      // Fallback: return mock data
      setData({
        online: 32,
        msg24h: 5432,
        dau: 128,
        points: Array.from({ length: 12 }).map((_, i) => ({
          t: `${i * 2}:00`,
          v: 200 + Math.floor(Math.random() * 1400),
        })),
      });
    }
  }, []);

  return { data, connected };
}
