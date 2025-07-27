'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => 
    new QueryClient({
      defaultOptions: {
        queries: {
          // 기본 캐시 시간 증가 (성능 개선)
          staleTime: 30 * 1000, // 30초
          gcTime: 5 * 60 * 1000, // 5분 (이전 cacheTime)
          
          // 재시도 정책 최적화
          retry: (failureCount, error: any) => {
            // 4xx 에러는 재시도하지 않음
            if (error?.response?.status >= 400 && error?.response?.status < 500) {
              return false;
            }
            // 최대 2번까지만 재시도
            return failureCount < 2;
          },
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
          
          // 네트워크 상태에 따른 자동 재시도 비활성화 (성능 개선)
          refetchOnWindowFocus: false,
          refetchOnReconnect: 'always',
          refetchOnMount: true,
        },
        mutations: {
          retry: 1,
          // 낙관적 업데이트를 위한 기본 설정
          onError: (error) => {
            if (process.env.NODE_ENV === 'development') {
              console.error('Mutation error:', error);
            }
          },
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
} 