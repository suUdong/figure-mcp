'use client';

/**
 * Enhanced Dashboard Layout Component
 * 완벽하게 정렬되고 최적화된 관리자 대시보드 레이아웃
 */
export default function EnhancedLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-25 via-white to-figure-25">
      {/* Enhanced Main Container */}
      <div className="mx-auto max-w-none px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-12 xl:py-12">
        
        {/* Page Header - Perfectly Aligned */}
        <header className="mb-8 lg:mb-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight sm:text-4xl lg:text-5xl">
                관리자 대시보드
              </h1>
              <p className="text-base text-gray-600 sm:text-lg lg:text-xl lg:leading-relaxed">
                Figure Backend Office에서 시스템을 모니터링하고 관리하세요
              </p>
            </div>
            
            {/* Status Indicator */}
            <div className="flex items-center gap-3 rounded-2xl border border-success-200 bg-success-50 px-6 py-3 shadow-sm">
              <div className="relative">
                <div className="h-3 w-3 rounded-full bg-success-500"></div>
                <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-success-400 opacity-75"></div>
              </div>
              <span className="text-sm font-semibold text-success-700">
                시스템 정상 운영 중
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Grid - Advanced Layout */}
        <main className="grid gap-8 lg:gap-12">
          
          {/* Metrics Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                시스템 메트릭
              </h2>
              <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
                자동 새로고침
              </div>
            </div>
            
            {/* Metrics Grid - Responsive & Perfectly Spaced */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Metric Card 1 */}
              <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-gray-100/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">활성 작업</p>
                    <p className="text-3xl font-bold text-gray-900">12</p>
                    <p className="text-xs text-success-600">+2.5% from last hour</p>
                  </div>
                  <div className="rounded-xl bg-figure-50 p-3">
                    <div className="h-6 w-6 rounded bg-figure-500"></div>
                  </div>
                </div>
                {/* Gradient Border Effect */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-figure-400 to-figure-600 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </div>

              {/* Metric Card 2 */}
              <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-gray-100/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">총 문서</p>
                    <p className="text-3xl font-bold text-gray-900">1,247</p>
                    <p className="text-xs text-success-600">+5.2% from yesterday</p>
                  </div>
                  <div className="rounded-xl bg-success-50 p-3">
                    <div className="h-6 w-6 rounded bg-success-500"></div>
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-success-400 to-success-600 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </div>

              {/* Metric Card 3 */}
              <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-gray-100/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">등록 사이트</p>
                    <p className="text-3xl font-bold text-gray-900">8</p>
                    <p className="text-xs text-gray-500">Active sites</p>
                  </div>
                  <div className="rounded-xl bg-info-50 p-3">
                    <div className="h-6 w-6 rounded bg-info-500"></div>
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-info-400 to-info-600 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </div>

              {/* Metric Card 4 */}
              <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-gray-100/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">응답 시간</p>
                    <p className="text-3xl font-bold text-gray-900">1.2s</p>
                    <p className="text-xs text-success-600">Excellent</p>
                  </div>
                  <div className="rounded-xl bg-warning-50 p-3">
                    <div className="h-6 w-6 rounded bg-warning-500"></div>
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-warning-400 to-warning-600 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </div>
            </div>
          </section>

          {/* Quick Actions Section */}
          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                빠른 작업
              </h2>
              <p className="text-sm text-gray-600 sm:text-base">
                자주 사용하는 기능들에 빠르게 접근하세요
              </p>
            </div>
            
            {/* Actions Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[
                { title: "문서 업로드", desc: "새 문서 추가", color: "figure" },
                { title: "RAG 테스트", desc: "질의응답 테스트", color: "success" },
                { title: "사이트 관리", desc: "사이트 설정", color: "info" },
                { title: "시스템 설정", desc: "환경 설정", color: "warning" }
              ].map((action, index) => (
                <div key={index} className="group cursor-pointer rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-gray-100/50 hover:-translate-y-1">
                  <div className="space-y-3">
                    <div className={`inline-flex rounded-xl bg-${action.color}-50 p-3`}>
                      <div className={`h-6 w-6 rounded bg-${action.color}-500`}></div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-gray-900">{action.title}</h3>
                      <p className="text-sm text-gray-600">{action.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* System Status Footer */}
          <footer className="mt-12 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Version
                </p>
                <p className="text-lg font-bold text-gray-900">v1.0.0</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Last Update
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {new Date().toLocaleDateString('ko-KR')}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Environment
                </p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success-500"></div>
                  <p className="text-lg font-bold text-gray-900">Production</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Support
                </p>
                <p className="text-lg font-bold text-figure-600 transition-colors hover:text-figure-700">
                  docs@figure.com
                </p>
              </div>
            </div>
          </footer>

        </main>
      </div>
    </div>
  );
} 