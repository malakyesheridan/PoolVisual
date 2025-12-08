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
      if (!url) {
        console.warn('[Texture Proxy] Missing URL parameter');
        return res.status(400).json({ error: 'MISSING_URL' });
      }

      console.log('[Texture Proxy] Proxying request:', { url, referer: req.get('referer') });

      const u = new URL(url);
      if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
        console.warn('[Texture Proxy] Bad protocol:', u.protocol);
        return res.status(400).json({ error: 'BAD_PROTOCOL' });
      }
      if (!ALLOW_ANY_HOST && !ALLOWED_HOSTS.has(u.host)) {
        console.warn('[Texture Proxy] Host not allowed:', u.host);
        return res.status(403).json({ error: 'HOST_NOT_ALLOWED', host: u.host });
      }

      const response = await fetch(u.toString(), {
        headers: {
          'User-Agent': 'PoolVisual/1.0 (+texture-proxy)',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Referer': url // Some servers check referer
        },
      });

      if (!response.ok || !response.body) {
        console.error('[Texture Proxy] Upstream failed:', {
          url,
          status: response.status,
          statusText: response.statusText
        });
        return res.status(502).json({ error: 'UPSTREAM_FAILED', status: response.status });
      }

      // Pass-through content-type; default to image/jpeg
      const ct = response.headers.get('content-type') || 'image/jpeg';
      res.set({
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      });

      console.log('[Texture Proxy] Successfully proxying image:', { url, contentType: ct });
      return response.body.pipe(res);
    } catch (err: any) {
      console.error('[Texture Proxy] Error:', err);
      return res.status(500).json({ error: 'PROXY_ERROR', message: err.message });
    }
  });
}