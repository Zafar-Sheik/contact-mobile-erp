import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for optimal Vercel deployment
  output: "standalone",

  // Image optimization settings
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Environment variables that should be available at build time
  env: {
    // These are exposed to the browser
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Contact Mobile ERP",
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // Compression
  compress: true,

  // Powered by header
  poweredByHeader: false,
};

export default nextConfig;
