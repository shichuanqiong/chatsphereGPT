/**
 * Unified base URL helper for handling dynamic base paths
 * Works with both BASE_URL='/' and future prefixed deployments
 */
export const withBase = (p: string): string => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const path = p.replace(/^\/+/, '');
  return `${base}/${path}`;
};
