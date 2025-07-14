import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from './providers/query-provider';

export const metadata: Metadata = {
  title: 'Figure Backend Office',
  description: 'Figure-MCP 관리자 대시보드',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans">
        <QueryProvider>
          <div className="min-h-screen bg-background">
            {children}
          </div>
        </QueryProvider>
      </body>
    </html>
  );
} 