import type { Express } from 'express';
// @ts-ignore - node-fetch import
import fetch from 'node-fetch';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
// Optionally restrict domains: add e.g. 'www.pooltile.com.au'
const ALLOW_ANY_HOST = true;
const ALLOWED_HOSTS = new Set<string>([
  'www.pooltile.com.au',
  'pooltile.com.au',
]);

export function registerTextureProxyRoutes(app: Express) {
  app.get('/api/texture', async (req, res) => {
    try {
      const url = req.query?.url as string;
      if (!url) return res.status(400).json({ error: 'MISSING_URL' });

      const u = new URL(url);
      if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
        return res.status(400).json({ error: 'BAD_PROTOCOL' });
      }
      if (!ALLOW_ANY_HOST && !ALLOWED_HOSTS.has(u.host)) {
        return res.status(403).json({ error: 'HOST_NOT_ALLOWED', host: u.host });
      }

      const response = await fetch(u.toString(), {
        headers: {
          'User-Agent': 'PoolVisual/1.0 (+texture-proxy)',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
      });

      if (!response.ok || !response.body) {
        return res.status(502).json({ error: 'UPSTREAM_FAILED', status: response.status });
      }

      // Pass-through content-type; default to image/jpeg
      const ct = response.headers.get('content-type') || 'image/jpeg';
      res.set({
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*'
      });

      return response.body.pipe(res);
    } catch (err: any) {
      console.error('texture proxy error:', err);
      return res.status(500).json({ error: 'PROXY_ERROR', message: err.message });
    }
  });
}