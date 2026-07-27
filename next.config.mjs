import { buildSecurityHeaders } from './config/security-headers.mjs';

const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // standalone нужен для тонкого образа Docker (ADR-0006)
  output: 'standalone',

  eslint: {
    dirs: ['src'],
  },

  async headers() {
    return [{ source: '/:path*', headers: buildSecurityHeaders(isDev) }];
  },
};

export default nextConfig;
