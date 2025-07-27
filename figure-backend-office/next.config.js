/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker in production only
  ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  
  // Enable hot reloading in Docker with optimized settings
  ...(process.env.NODE_ENV === 'development' && {
    webpack: (config, { dev }) => {
      if (dev) {
        config.watchOptions = {
          poll: 2000, // 2초로 증가 (1초 → 2초) - CPU 부하 감소
          aggregateTimeout: 500, // 500ms로 증가 (300ms → 500ms)
          ignored: /node_modules/, // node_modules 폴더 감시 제외
        };
      }
      return config;
    },
  }),
  
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
      // 시스템 헬스체크 엔드포인트들을 백엔드로 프록시
      {
        source: '/health',
        destination: `${process.env.BACKEND_API_URL || 'http://figure-backend:8001'}/health`,
      },
      {
        source: '/status',
        destination: `${process.env.BACKEND_API_URL || 'http://figure-backend:8001'}/status`,
      },
    ];
  },
  // 성능 최적화 설정 추가
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog'],
  },
  // 압축 활성화
  compress: true,
  // 정적 파일 최적화
  generateEtags: false,
  poweredByHeader: false,
};

module.exports = nextConfig; 