'use client';

import { useState } from 'react';
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
  },
  {
    title: '사이트 관리',
    href: '/sites',
    icon: Globe,
  },
];

function NavigationItem({ item, level = 0 }: { item: NavigationItem; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();
  const isActive = item.href === pathname;
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const ItemContent = () => (
    <div className={cn(
      "flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg transition-colors",
      level > 0 && "ml-4",
      isActive 
        ? "bg-primary text-primary-foreground" 
        : "text-foreground hover:bg-accent hover:text-accent-foreground"
    )}>
      <div className="flex items-center space-x-2">
        <item.icon className="h-4 w-4" />
        <span>{item.title}</span>
      </div>
      {hasChildren && (
        <div className="ml-auto">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {item.href && !hasChildren ? (
        <Link href={item.href} className="block">
          <ItemContent />
        </Link>
      ) : (
        <button onClick={handleClick} className="w-full">
          <ItemContent />
        </button>
      )}
      
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {item.children!.map((child, index) => (
            <NavigationItem key={index} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-64 transform border-r bg-background transition-transform duration-200 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item, index) => (
              <NavigationItem key={index} item={item} />
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="text-xs text-muted-foreground">
              <p>Version 1.0.0</p>
              <p>© 2024 Figure Backend Office</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
} 