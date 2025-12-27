const API_PROXY_TARGET = process.env.API_PROXY_TARGET || "http://localhost:8080";
const WS_PROXY_TARGET = process.env.WS_PROXY_TARGET || "http://localhost:6789"; // Next rewrites require http/https; WS upgrades still work
const LIVEKIT_PROXY_TARGET = process.env.LIVEKIT_PROXY_TARGET || "http://localhost:7880";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SSR build for docker runtime.
  output: 'standalone',
  trailingSlash: false,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_PROXY_TARGET}/api/:path*` },
      // WebSocket proxy (for local dev without Caddy/nginx). Caddy will short-circuit this in prod.
      { source: '/yjs', destination: `${WS_PROXY_TARGET}/yjs` },
      { source: '/yjs/:path*', destination: `${WS_PROXY_TARGET}/:path*` },
      { source: '/ws/:path*', destination: `${WS_PROXY_TARGET}/:path*` },
      // LiveKit proxy
      { source: '/livekit/:path*', destination: `${LIVEKIT_PROXY_TARGET}/:path*` },
    ];
  },
};

module.exports = nextConfig;
