import React, { createContext, useContext, useEffect, useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';

export type SeoConfig = {
  title: string;
  description: string;
  keywords: string;
  canonicalBase: string;
  ogImage: string;
  twitterCard: 'summary' | 'summary_large_image';
  robotsTxt: string;
};

const DEFAULT_SEO: SeoConfig = {
  title: 'ChatSphere — Real-time Social Chat Community',
  description: 'A clean, respectful place to talk. Start rooms or DMs instantly.',
  keywords: 'chat, realtime, community, chatsphere',
  canonicalBase: 'https://chatsphere.app',
  ogImage: 'https://chatsphere.app/og.jpg',
  twitterCard: 'summary_large_image',
  robotsTxt: 'User-agent: *\nDisallow: /admin\nSitemap: https://chatsphere.app/sitemap.xml',
};

const SeoCtx = createContext<{ cfg: SeoConfig; refresh: () => Promise<void> }>({ cfg: DEFAULT_SEO, refresh: async () => {} });
export const useSeo = () => useContext(SeoCtx);

export function SeoProvider({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<SeoConfig>(DEFAULT_SEO);

  async function refresh() {
    try {
      const res = await fetch('/api/admin/seo', { credentials: 'include' });
      if (res.ok) setCfg(await res.json());
    } catch (e) {
      console.debug('SEO config load skipped (mock mode)');
    }
  }

  useEffect(() => { refresh(); }, []);

  const canonical = typeof window !== 'undefined' ? `${cfg.canonicalBase}${window.location.pathname}` : cfg.canonicalBase;

  return (
    <HelmetProvider>
      <SeoCtx.Provider value={{ cfg, refresh }}>
        <Helmet>
          <title>{cfg.title}</title>
          <meta name="description" content={cfg.description} />
          <meta name="keywords" content={cfg.keywords} />
          <link rel="canonical" href={canonical} />
          {/* Open Graph */}
          <meta property="og:type" content="website" />
          <meta property="og:title" content={cfg.title} />
          <meta property="og:description" content={cfg.description} />
          <meta property="og:image" content={cfg.ogImage} />
          <meta property="og:url" content={canonical} />
          {/* Twitter */}
          <meta name="twitter:card" content={cfg.twitterCard} />
          <meta name="twitter:title" content={cfg.title} />
          <meta name="twitter:description" content={cfg.description} />
          <meta name="twitter:image" content={cfg.ogImage} />
          {/* JSON-LD */}
          <script type="application/ld+json">{JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'ChatSphere',
            url: cfg.canonicalBase,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${cfg.canonicalBase}/search?q={query}`,
              'query-input': 'required name=query'
            }
          })}</script>
        </Helmet>
        {children}
      </SeoCtx.Provider>
    </HelmetProvider>
  );
}
