'use client';

import { useState } from 'react';
import Header from './header';
import Sidebar from './sidebar';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Header */}
      <Header 
        onMenuClick={handleSidebarToggle}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
      />

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-200 ease-in-out",
        "pt-16", // Header height
        "md:ml-64" // Sidebar width on desktop
      )}>
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
} 