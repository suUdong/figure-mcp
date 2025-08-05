import MainLayout from './components/layout/main-layout';
import MetricsCards from './components/dashboard/metrics-cards';
import QuickActions from './components/dashboard/quick-actions';
import ProtectedRoute from './components/auth/protected-route';

export default function Home() {
  return (
    <ProtectedRoute>
      <MainLayout>
      {/* Page Header Section */}
      <section className="flex flex-col gap-2 lg:gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
            대시보드
          </h1>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
            Figure Backend Office 관리자 대시보드에 오신 것을 환영합니다.
          </p>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="space-y-4 lg:space-y-6 pt-2">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          시스템 메트릭
        </h2>
        
        {/* Enhanced Metrics Cards with Better Spacing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <MetricsCards />
        </div>
      </section>

      {/* Quick Actions Section */}
      <section className="space-y-4 lg:space-y-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          빠른 작업
        </h2>
        
        {/* Enhanced Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <QuickActions />
        </div>
      </section>

      </MainLayout>
    </ProtectedRoute>
  );
} 