'use client';

import { Button } from '@/components/ui/button';
import { User, Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };


  return (
    <header 
      className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 shadow-sm"
      role="banner"
      aria-label="메인 헤더"
    >
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Left Section: Menu & Logo */}
        <div className="flex items-center gap-4">
          {/* Menu Toggle Button - Mobile Only */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden hover:bg-gray-50 focus:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figure-500 focus-visible:ring-offset-2"
            onClick={onMenuToggle}
            aria-label="사이드바 메뉴 열기"
            aria-expanded="false"
            aria-controls="sidebar-navigation"
          >
            <Menu className="h-5 w-5 text-gray-700" aria-hidden="true" />
          </Button>

          {/* Logo and Brand */}
          <div className="flex items-center gap-3" role="img" aria-label="Figure Backend Office 로고">
            <div 
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-figure-500 to-figure-600 shadow-md"
              aria-hidden="true"
            >
              <span className="text-sm font-bold text-white">F</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">
                Figure Backend Office
              </h1>
              <p className="text-xs text-gray-500 leading-tight">
                관리자 대시보드
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: User & Actions */}
        <div className="flex items-center gap-3" role="toolbar" aria-label="사용자 액션">
          {/* User Info */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
              <User className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">
                {user?.username || 'admin'}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleLogout}
            className="hover:bg-gray-50 focus:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figure-500 focus-visible:ring-offset-2"
            aria-label="로그아웃"
          >
            <LogOut className="h-4 w-4 text-gray-600 mr-1" aria-hidden="true" />
            <span className="hidden sm:inline">로그아웃</span>
          </Button>
        </div>
      </div>
    </header>
  );
} 