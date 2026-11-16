// API_URL is read at BUILD time (rewrites are baked into the build). On Render set it before the first deploy.
// The browser only ever talks to this site (/api/...); the API address and any secret stay on the server side.
const API_URL = (process.env.API_URL || '').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: false, // the rewrite proxies a server-sent-events stream (/api/notifications/stream); gzip would buffer it. Render's edge compresses anyway.
  poweredByHeader: false,
  async rewrites() {
    if (!API_URL) return [];
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ];
    return [
      { source: '/:path*', headers: security },
      // The service worker must never be cached by the browser or CDN, otherwise updates never arrive.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
};

export default nextConfig;
