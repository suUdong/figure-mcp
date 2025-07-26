'use client';

import { useState } from 'react';
import Header from './header';
import Sidebar from './sidebar';

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
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="space-y-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 