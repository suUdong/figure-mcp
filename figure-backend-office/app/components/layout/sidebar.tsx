'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Globe,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Settings,
  HelpCircle,
  Cpu,
  TestTube,
  Activity,
  Link as LinkIcon,
  Target,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavigationItem[];
  badge?: string;
}

const navigation: NavigationItem[] = [
  {
    title: '대시보드',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: '문서 관리',
    icon: FileText,
    children: [
      { title: '문서 목록', href: '/documents', icon: FileText },
      { title: '문서 업로드', href: '/documents/upload', icon: FileText },
    ],
  },
  {
    title: 'RAG 테스트',
    href: '/rag',
    icon: MessageSquare,
    badge: 'New',
  },
  {
    title: '사이트 관리',
    href: '/sites',
    icon: Globe,
  },
  {
    title: 'LLM 지침 관리',
    href: '/guidelines',
    icon: Target,
    badge: '🎯',
  },
  {
    title: 'MCP 관리',
    icon: Cpu,
    badge: 'API',
    children: [
      { title: 'API 테스트', href: '/mcp/api-test', icon: TestTube },
      { title: 'API 모니터링', href: '/mcp/monitoring', icon: Activity },
      { title: 'API 문서', href: '/mcp/docs', icon: FileText },
      { title: '템플릿 매칭', href: '/mcp/template-matching', icon: LinkIcon },
    ],
  },
];

function NavigationItem({ item, level = 0 }: { item: NavigationItem; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();
  const hasChildren = item.children && item.children.length > 0;
  
  // Check if current item or its children are active
  const isActive = item.href === pathname || 
    (hasChildren && item.children!.some(child => child.href === pathname));
  
  // Auto-expand if a child is active
  useEffect(() => {
    if (hasChildren && item.children!.some(child => child.href === pathname)) {
      setIsExpanded(true);
    }
  }, [pathname, hasChildren, item.children]);

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (hasChildren && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  const ItemContent = () => (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figure-500 focus-visible:ring-offset-2",
      level > 0 ? "ml-6 py-2" : "",
      isActive 
        ? "bg-gradient-to-r from-figure-500 to-figure-600 text-white shadow-lg shadow-figure-500/25" 
        : "text-gray-700 hover:text-gray-900 hover:bg-figure-50 hover:shadow-sm",
      hasChildren && "cursor-pointer"
    )}>
      <div className={cn(
        "flex items-center justify-center w-5 h-5 transition-colors",
        level > 0 ? "w-4 h-4" : "",
        isActive ? "text-white" : "text-gray-500 group-hover:text-figure-600"
      )}>
        <item.icon className="w-full h-full" />
      </div>
      
      <div className="flex-1 flex items-center justify-between">
        <span className="truncate">{item.title}</span>
        
        {item.badge && (
          <span 
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
              isActive 
                ? "bg-white/20 text-white border-white/30" 
                : "bg-figure-50 text-figure-700 border-figure-200"
            )}
            aria-label={`${item.badge} 상태`}
          >
            {item.badge}
          </span>
        )}
      </div>
      
      {hasChildren && (
        <div 
          className={cn(
            "flex items-center justify-center w-5 h-5 transition-transform duration-200",
            isExpanded && "rotate-180",
            isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600"
          )}
          aria-hidden="true"
        >
          <ChevronDown className="h-4 w-4" />
        </div>
      )}
    </div>
  );

  return (
    <div>
      {item.href && !hasChildren ? (
        <Link 
          href={item.href} 
          className="block focus-visible:outline-none"
          aria-current={isActive ? 'page' : undefined}
        >
          <ItemContent />
        </Link>
      ) : (
        <button 
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className="w-full text-left focus-visible:outline-none"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-haspopup={hasChildren ? 'menu' : undefined}
          aria-label={hasChildren 
            ? `${item.title} 메뉴 ${isExpanded ? '닫기' : '열기'}` 
            : item.title
          }
        >
          <ItemContent />
        </button>
      )}
      
      {hasChildren && isExpanded && (
        <div 
          className="mt-1 space-y-1 animate-slide-in-from-top"
          role="menu"
          aria-label={`${item.title} 하위 메뉴`}
        >
          {item.children!.map((child, index) => (
            <NavigationItem key={index} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  // Focus management for mobile
  useEffect(() => {
    if (isOpen) {
      // Focus the first navigation item when sidebar opens on mobile
      const firstFocusable = document.querySelector(
        'aside[aria-label="메인 네비게이션"] a, aside[aria-label="메인 네비게이션"] button'
      ) as HTMLElement;
      if (firstFocusable && window.innerWidth < 768) {
        setTimeout(() => firstFocusable.focus(), 100);
      }
    }
  }, [isOpen]);

  // Handle escape key to close sidebar on mobile
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && window.innerWidth < 768) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only-focusable"
      >
        메인 콘텐츠로 바로가기
      </a>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden transition-opacity duration-200"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClose();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="사이드바 닫기"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-64 transform",
          "border-r border-gray-100 bg-white shadow-xl transition-transform duration-300 ease-spring",
          "md:translate-x-0 md:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="메인 네비게이션"
        role="navigation"
      >
        <div className="flex h-full flex-col">


          {/* Navigation Menu */}
          <nav 
            className="flex-1 space-y-2 px-4 py-6 overflow-y-auto scrollbar-hide"
            role="menubar"
            aria-label="주요 네비게이션 메뉴"
          >
            {navigation.map((item, index) => (
              <NavigationItem key={index} item={item} />
            ))}
          </nav>

          {/* Bottom Section */}
          <div className="flex-shrink-0 border-t border-gray-50 p-4 space-y-4">
            {/* Quick Actions */}
            <div className="space-y-2" role="group" aria-label="빠른 작업">
              <button 
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figure-500 focus-visible:ring-offset-2"
                aria-label="시스템 설정"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                <span>설정</span>
              </button>
              
              <button 
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figure-500 focus-visible:ring-offset-2"
                aria-label="도움말 및 지원"
              >
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                <span>도움말</span>
              </button>
            </div>

            {/* Footer Info */}
            <div className="pt-4 border-t border-gray-50">
              <div className="text-xs text-gray-500 space-y-1" role="group" aria-label="시스템 정보">
                <div className="flex items-center justify-between">
                  <span>Version</span>
                  <span className="font-medium text-gray-700">1.0.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <div className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full bg-success-500"
                      aria-hidden="true"
                    ></div>
                    <span 
                      className="font-medium text-success-700"
                      aria-label="시스템 상태: 온라인"
                    >
                      Online
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                © 2024 Figure Backend Office
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
} 