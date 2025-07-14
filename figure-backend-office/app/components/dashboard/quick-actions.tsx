'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Database, Upload } from 'lucide-react';

const quickActions = [
  {
    title: '문서 업로드',
    description: '새로운 문서를 업로드하고 벡터화합니다.',
    icon: Upload,
    href: '/documents/upload',
    variant: 'default' as const,
  },
  {
    title: '문서 관리',
    description: '문서를 조회하고 관리합니다.',
    icon: FileText,
    href: '/documents',
    variant: 'outline' as const,
  },
  {
    title: '사이트 관리',
    description: '새로운 사이트를 등록하고 관리합니다.',
    icon: Database,
    href: '/sites',
    variant: 'outline' as const,
  },
];

export default function QuickActions() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {quickActions.map((action, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <action.icon className="h-5 w-5" />
              <span>{action.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {action.description}
            </p>
            <Link href={action.href}>
              <Button variant={action.variant} className="w-full">
                {action.title}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 