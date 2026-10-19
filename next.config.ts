import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hostinger's managed Next.js runner uses `next start`.
  compress: true,
  
   experimental: {
    cpus: 1,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  // HTTP Performance & Security headers
  async headers() {
    return [
      {
        source: '/(.*)\\.(png|jpg|jpeg|webp|avif|ico|svg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
