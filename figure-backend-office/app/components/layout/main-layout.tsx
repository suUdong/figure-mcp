'use client';

import { useState, Suspense } from 'react';
import Header from './header';
import Sidebar from './sidebar';

// 로딩 컴포넌트
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-figure-600"></div>
        <p className="text-sm text-gray-600">로딩 중...</p>
      </div>
    </div>
  );
}

// 에러 폴백 컴포넌트
function ErrorFallback({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="text-red-500 text-lg font-semibold">
          오류가 발생했습니다
        </div>
        <p className="text-gray-600 text-sm max-w-md">
          {error.message || '예상치 못한 오류가 발생했습니다.'}
        </p>
        {retry && (
          <button
            onClick={retry}
            className="px-4 py-2 bg-figure-600 text-white rounded-lg hover:bg-figure-700 transition-colors"
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Layout Container */}
      <div className="flex">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 md:ml-64 mt-16 min-h-[calc(100vh-4rem)]"
          role="main"
          aria-label="메인 콘텐츠"
        >
          <div className="mx-auto max-w-full px-4 py-8 sm:px-6 lg:px-8 xl:max-w-screen-2xl">
            <div className="space-y-8">
              <Suspense fallback={<LoadingSpinner />}>
                {children}
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 