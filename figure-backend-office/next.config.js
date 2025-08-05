/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker in production only
  ...(process.env.NODE_ENV === "production" && { output: "standalone" }),

  // 개발 환경 성능 최적화 (단순화)
  experimental: {
    // Fast Refresh 성능 개선
    optimizeCss: false,
    esmExternals: false,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  // 개발 서버 최적화
  generateEtags: false,
  poweredByHeader: false,

  env: {
    BACKEND_API_URL:
      process.env.BACKEND_API_URL || "http://figure-backend:8001",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${
          process.env.BACKEND_API_URL || "http://figure-backend:8001"
        }/api/:path*`,
      },
      {
        source: "/health",
        destination: `${
          process.env.BACKEND_API_URL || "http://figure-backend:8001"
        }/health`,
      },
      {
        source: "/status",
        destination: `${
          process.env.BACKEND_API_URL || "http://figure-backend:8001"
        }/status`,
      },
    ];
  },
};

module.exports = nextConfig;
