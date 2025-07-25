import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "./providers/query-provider";
import { AuthProvider } from "./providers/auth-provider";

export const metadata: Metadata = {
  title: "Figure Backend Office",
  description: "Figure-MCP 관리자 대시보드",
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
          <AuthProvider>
            <div className="min-h-screen bg-background">{children}</div>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
