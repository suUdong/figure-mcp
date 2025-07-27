import MainLayout from './components/layout/main-layout';
import MetricsCards from './components/dashboard/metrics-cards';
import QuickActions from './components/dashboard/quick-actions';

export default function Home() {
  return (
    <MainLayout>
      {/* Page Header Section */}
      <section className="flex flex-col gap-2 lg:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
              대시보드
            </h1>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Figure Backend Office 관리자 대시보드에 오신 것을 환영합니다.
            </p>
          </div>
          
          {/* Quick Stats Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-figure-50 border border-figure-200 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-figure-500 animate-pulse"></div>
            <span className="text-sm font-medium text-figure-700">
              실시간 모니터링 중
            </span>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="space-y-4 lg:space-y-6 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            시스템 메트릭
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-xs sm:text-sm text-gray-500 px-3 py-1 bg-gray-50 rounded-full border">
              실시간 업데이트
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-50 border border-success-200">
              <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-xs font-medium text-success-700">실시간 연결</span>
            </div>
          </div>
        </div>
        
        {/* Enhanced Metrics Cards with Better Spacing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
          <MetricsCards />
        </div>
      </section>

      {/* Quick Actions Section */}
      <section className="space-y-4 lg:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            빠른 작업
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            자주 사용하는 기능들에 빠르게 접근하세요
          </p>
        </div>
        
        {/* Enhanced Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          <QuickActions />
        </div>
      </section>

      {/* System Information Footer */}
      <section className="mt-8 lg:mt-12 pt-6 lg:pt-8 border-t border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Version
            </span>
            <span className="text-sm font-semibold text-gray-900">
              v1.0.0
            </span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Last Update
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {new Date().toLocaleDateString('ko-KR')}
            </span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Environment
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-success-500"></div>
              <span className="text-gray-900">Production</span>
            </span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Support
            </span>
            <span className="text-sm font-semibold text-figure-600 hover:text-figure-700 cursor-pointer transition-colors">
              docs@figure.com
            </span>
          </div>
        </div>
      </section>
    </MainLayout>
  );
} 