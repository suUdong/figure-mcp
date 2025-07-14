'use client';

import { Button } from '@/components/ui/button';
import { Bell, Settings, User, Menu, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/hooks/use-websocket';

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

export default function Header({ onMenuClick, isSidebarOpen }: HeaderProps) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001/admin/ws';
  const { isConnected, error } = useWebSocket(wsUrl);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4">
        {/* Menu Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-4 md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">메뉴 토글</span>
        </Button>

        {/* Logo and Title */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">F</span>
            </div>
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold">Figure Backend Office</h1>
              <p className="text-xs text-muted-foreground">관리자 대시보드</p>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Header Actions */}
        <div className="flex items-center space-x-2">
          {/* WebSocket Connection Status */}
          <div className={`hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : error 
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>실시간 연결됨</span>
              </>
            ) : error ? (
              <>
                <WifiOff className="w-3 h-3" />
                <span>연결 오류</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>연결 중...</span>
              </>
            )}
          </div>

          {/* System Status */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>시스템 정상</span>
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              3
            </span>
            <span className="sr-only">알림</span>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
            <span className="sr-only">설정</span>
          </Button>

          {/* User Profile */}
          <Button variant="ghost" size="icon">
            <User className="h-4 w-4" />
            <span className="sr-only">사용자 프로필</span>
          </Button>
        </div>
      </div>
    </header>
  );
} 