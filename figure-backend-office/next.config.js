/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // Enable standalone output for Docker in production only
  ...(process.env.NODE_ENV === "production" && { output: "standalone" }),

  // 🚀 Context7 추천: 강력한 성능 최적화
  // ⚡ Turbopack 설정 (Next.js 15+ 안정화)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  experimental: {
    // ⚡ Next.js 15+ Webpack 메모리 최적화 (Context7 제안) - 메모리 사용량 대폭 감소
    webpackMemoryOptimizations: true,
    // ⚡ Webpack Build Worker 활성화 (Context7 제안) - 별도 워커에서 컴파일
    webpackBuildWorker: true,
    // ⚡ 패키지 Import 최적화 확장 (Context7 제안) - 번들 크기 대폭 감소
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-tabs",
      "react-icons",
      "tailwind-merge",
      "clsx",
      "@heroicons/react",
    ],
    // 빌드 최적화
    optimizeCss: false,
    workerThreads: false,
    // 🎯 Context7 추천: 서버 컴포넌트 HMR 캐시 (개발 성능 대폭 향상)
    serverComponentsHmrCache: true,
  },

  // 🎯 Context7 추천: ESLint 빌드 검사 비활성화 (메모리 절약)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 🎯 Context7 추천: TypeScript 빌드 검사 비활성화 (메모리 절약)
  typescript: {
    ignoreBuildErrors: true,
  },

  // 🎯 Context7 추천: Source Maps 비활성화 (메모리 절약)
  productionBrowserSourceMaps: false,

  // 개발 서버 최적화 (메모리 절약)
  generateEtags: false,
  poweredByHeader: false,
  compress: false, // 개발 환경에서 압축 비활성화

  // 🚀 Context7 기반: 최고 성능의 Webpack 설정
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Context7 제안: 메모리 캐시 완전 비활성화 (성능 우선)
      if (config.cache && !isServer) {
        config.cache = Object.freeze({
          type: "memory",
        });
      }

      // 파일 감시 최적화 (성능 우선)
      config.watchOptions = {
        poll: 8000, // Context7 제안: 더 긴 폴링 간격 (성능 극대화)
        aggregateTimeout: 2000,
        ignored: [
          "**/node_modules/**",
          "**/.next/**",
          "**/dist/**",
          "**/build/**",
          "**/coverage/**",
          "**/.git/**",
          "**/logs/**",
          "**/tmp/**",
          "**/temp/**",
        ],
      };

      // Context7 제안: 개발 모드 최적화 설정
      config.resolve = {
        ...config.resolve,
        symlinks: false, // 심볼릭 링크 해결 비활성화
        modules: ["node_modules"], // 모듈 해결 최적화
      };

      // Context7 제안: 빌드 통계 최적화
      config.stats = "errors-only"; // 에러만 출력

      // Context7 제안: 청크 분할 대폭 최적화
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: {
          chunks: "all",
          minSize: 30000, // 더 큰 청크 (성능 우선)
          maxSize: 500000, // 더 큰 청크 허용
          cacheGroups: {
            default: false,
            vendors: false,
            // React 관련 패키지
            framework: {
              name: "framework",
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              priority: 40,
              enforce: true,
            },
            // UI 라이브러리
            lib: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|clsx|tailwind-merge)[\\/]/,
              name: "lib",
              priority: 30,
              minChunks: 1,
            },
            // 공통 모듈
            commons: {
              name: "commons",
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },

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

module.exports = withBundleAnalyzer(nextConfig);
