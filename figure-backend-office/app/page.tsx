import MainLayout from './components/layout/main-layout';
import MetricsCards from './components/dashboard/metrics-cards';
import QuickActions from './components/dashboard/quick-actions';

export default function Home() {
  return (
    <MainLayout>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          Figure Backend Office 관리자 대시보드에 오신 것을 환영합니다.
        </p>
      </div>

      {/* Real-time Metrics Cards */}
      <MetricsCards />

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">빠른 작업</h2>
        <QuickActions />
      </div>
    </MainLayout>
  );
} 