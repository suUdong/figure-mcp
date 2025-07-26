'use client';

import { Button } from '@/components/ui/button';
import { Bell, Settings, User, Menu, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/hooks/use-websocket';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001/admin/ws';
  const { isConnected, error } = useWebSocket(wsUrl);

  const getConnectionStatus = () => {
    if (isConnected) return { status: 'connected', text: '실시간 연결', icon: Wifi };
    if (error) return { status: 'error', text: '연결 오류', icon: WifiOff };
    return { status: 'connecting', text: '연결 중...', icon: WifiOff };
  };

  const connectionStatus = getConnectionStatus();

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

        {/* Right Section: Status & Actions */}
        <div className="flex items-center gap-2 lg:gap-3" role="toolbar" aria-label="헤더 액션">
          {/* Connection Status */}
          <div 
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              connectionStatus.status === 'connected'
                ? 'bg-success-50 text-success-700 border border-success-200 focus-visible:ring-success-500' 
                : connectionStatus.status === 'error'
                  ? 'bg-error-50 text-error-700 border border-error-200 focus-visible:ring-error-500'
                  : 'bg-warning-50 text-warning-700 border border-warning-200 focus-visible:ring-warning-500'
            }`}
            role="status"
            aria-live="polite"
            aria-label={`WebSocket 연결 상태: ${connectionStatus.text}`}
            tabIndex={0}
          >
            <connectionStatus.icon className="w-3 h-3" aria-hidden="true" />
            <span>{connectionStatus.text}</span>
          </div>

          {/* System Status */}
          <div 
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-50 text-success-700 border border-success-200 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500 focus-visible:ring-offset-1"
            role="status"
            aria-live="polite"
            aria-label="시스템 상태: 정상 작동 중"
            tabIndex={0}
          >
            <div 
              className="w-2 h-2 rounded-full bg-success-500 animate-pulse" 
              aria-hidden="true"
            />
            <span>시스템 정상</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1" role="group" aria-label="사용자 액션">
            {/* Notifications */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative hover:bg-gray-50 focus:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figure-500 focus-visible:ring-offset-2"
              aria-label="알림 3개 - 새로운 알림이 있습니다"
              aria-describedby="notification-count"
            >
              <Bell className="h-4 w-4 text-gray-600" aria-hidden="true" />
              <span 
                id="notification-count"
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-error-500 text-white text-xs flex items-center justify-center font-medium shadow-sm"
                aria-label="3개의 읽지 않은 알림"
              >
                3
              </span>
            </Button>

            {/* Settings */}
            <Button 
              variant="ghost" 
              size="icon"
              className="hover:bg-gray-50 focus:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figure-500 focus-visible:ring-offset-2"
              aria-label="시스템 설정 및 환경설정"
            >
              <Settings className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </Button>

            {/* User Profile */}
            <Button 
              variant="ghost" 
              size="icon"
              className="hover:bg-gray-50 focus:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figure-500 focus-visible:ring-offset-2"
              aria-label="사용자 프로필 및 계정 설정"
              aria-haspopup="menu"
            >
              <User className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
} 