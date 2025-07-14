/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    BACKEND_API_URL: process.env.BACKEND_API_URL || 'http://figure-backend:8001',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://figure-backend:8001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig; 