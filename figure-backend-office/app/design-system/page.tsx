"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// 타입 정의
interface ColorItem {
  name: string;
  value: string;
  hex: string;
  isPrimary?: boolean;
  category?: string;
}

interface ColorPalette {
  name: string;
  description: string;
  colors: ColorItem[];
}

// 색상 팔레트 데이터
const colorPalettes: Record<string, ColorPalette> = {
  figure: {
    name: "Figure 브랜드",
    description: "Figure의 주요 브랜드 색상",
    colors: [
      { name: "figure-50", value: "hsl(214 100% 97%)", hex: "#f0f9ff" },
      { name: "figure-100", value: "hsl(214 95% 93%)", hex: "#e0f2fe" },
      { name: "figure-200", value: "hsl(213 97% 87%)", hex: "#bae6fd" },
      { name: "figure-300", value: "hsl(212 96% 78%)", hex: "#7dd3fc" },
      { name: "figure-400", value: "hsl(213 94% 68%)", hex: "#38bdf8" },
      {
        name: "figure-500",
        value: "hsl(199 89% 48%)",
        hex: "#0ea5e9",
        isPrimary: true,
      },
      { name: "figure-600", value: "hsl(200 98% 39%)", hex: "#0284c7" },
      { name: "figure-700", value: "hsl(201 96% 32%)", hex: "#0369a1" },
      { name: "figure-800", value: "hsl(201 90% 27%)", hex: "#075985" },
      { name: "figure-900", value: "hsl(202 80% 24%)", hex: "#0c4a6e" },
      { name: "figure-950", value: "hsl(202 80% 16%)", hex: "#082f49" },
    ],
  },
  status: {
    name: "상태 색상",
    description: "성공, 경고, 오류, 정보를 나타내는 색상",
    colors: [
      {
        name: "success-500",
        value: "hsl(142 76% 36%)",
        hex: "#16a34a",
        category: "success",
      },
      {
        name: "warning-500",
        value: "hsl(45 93% 47%)",
        hex: "#eab308",
        category: "warning",
      },
      {
        name: "error-500",
        value: "hsl(0 84% 60%)",
        hex: "#ef4444",
        category: "error",
      },
      {
        name: "info-500",
        value: "hsl(217 91% 60%)",
        hex: "#3b82f6",
        category: "info",
      },
    ],
  },
};

// 타이포그래피 스케일
const typographyScale = [
  {
    name: "display-2xl",
    size: "4.5rem",
    lineHeight: "90%",
    usage: "대형 헤드라인",
  },
  {
    name: "display-xl",
    size: "3.75rem",
    lineHeight: "90%",
    usage: "대형 제목",
  },
  { name: "display-lg", size: "3rem", lineHeight: "95%", usage: "페이지 제목" },
  {
    name: "display-md",
    size: "2.25rem",
    lineHeight: "100%",
    usage: "섹션 제목",
  },
  {
    name: "display-sm",
    size: "1.875rem",
    lineHeight: "110%",
    usage: "카드 제목",
  },
  {
    name: "display-xs",
    size: "1.5rem",
    lineHeight: "110%",
    usage: "서브 제목",
  },
  { name: "text-xl", size: "1.25rem", lineHeight: "150%", usage: "큰 본문" },
  { name: "text-lg", size: "1.125rem", lineHeight: "150%", usage: "본문" },
  { name: "text-md", size: "1rem", lineHeight: "150%", usage: "기본 본문" },
  {
    name: "text-sm",
    size: "0.875rem",
    lineHeight: "140%",
    usage: "작은 텍스트",
  },
  { name: "text-xs", size: "0.75rem", lineHeight: "140%", usage: "캡션" },
];

// 스페이싱 스케일
const spacingScale = [
  { name: "0.5", value: "0.125rem", px: "2px" },
  { name: "1", value: "0.25rem", px: "4px" },
  { name: "1.5", value: "0.375rem", px: "6px" },
  { name: "2", value: "0.5rem", px: "8px" },
  { name: "2.5", value: "0.625rem", px: "10px" },
  { name: "3", value: "0.75rem", px: "12px" },
  { name: "4", value: "1rem", px: "16px" },
  { name: "5", value: "1.25rem", px: "20px" },
  { name: "6", value: "1.5rem", px: "24px" },
  { name: "8", value: "2rem", px: "32px" },
  { name: "10", value: "2.5rem", px: "40px" },
  { name: "12", value: "3rem", px: "48px" },
];

export default function DesignSystemPage() {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedColor(value);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* 헤더 */}
        <div>
          <h1 className="text-display-lg font-bold text-gray-900 mb-2">
            Design System
          </h1>
          <p className="text-text-lg text-gray-600">
            Figure Admin의 디자인 토큰 시스템을 확인하고 테스트할 수 있습니다.
          </p>
        </div>

        <Tabs defaultValue="colors" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="colors">색상</TabsTrigger>
            <TabsTrigger value="typography">타이포그래피</TabsTrigger>
            <TabsTrigger value="spacing">스페이싱</TabsTrigger>
            <TabsTrigger value="components">컴포넌트</TabsTrigger>
          </TabsList>

          {/* 색상 탭 */}
          <TabsContent value="colors" className="space-y-6">
            {Object.entries(colorPalettes).map(([key, palette]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle>{palette.name}</CardTitle>
                  <CardDescription>{palette.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {palette.colors.map((color) => (
                      <div
                        key={color.name}
                        className="group cursor-pointer"
                        onClick={() => copyToClipboard(`bg-${color.name}`)}
                      >
                        <div
                          className={`w-full h-20 rounded-lg mb-2 border border-gray-200 ${
                            color.isPrimary ? "ring-2 ring-figure-400" : ""
                          }`}
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {color.name}
                          </p>
                          <p className="text-gray-500 font-mono text-xs">
                            {color.hex}
                          </p>
                          {copiedColor === `bg-${color.name}` && (
                            <p className="text-success-500 text-xs">복사됨!</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* 타이포그래피 탭 */}
          <TabsContent value="typography" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>타이포그래피 스케일</CardTitle>
                <CardDescription>
                  일관된 텍스트 크기와 라인 높이를 위한 타이포그래피 시스템
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {typographyScale.map((type) => (
                  <div
                    key={type.name}
                    className="border-b border-gray-100 pb-4 last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-4">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          text-{type.name}
                        </code>
                        <span className="text-sm text-gray-500">
                          {type.size} / {type.lineHeight}
                        </span>
                        <Badge variant="secondary">{type.usage}</Badge>
                      </div>
                    </div>
                    <p className={`text-${type.name} text-gray-900`}>
                      안녕하세요, Figure Design System입니다.
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 스페이싱 탭 */}
          <TabsContent value="spacing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>스페이싱 스케일</CardTitle>
                <CardDescription>
                  일관된 간격을 위한 스페이싱 시스템
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {spacingScale.map((space) => (
                    <div
                      key={space.name}
                      className="flex items-center space-x-4"
                    >
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono w-16">
                        {space.name}
                      </code>
                      <div className="flex items-center space-x-2">
                        <div
                          className="bg-figure-500 rounded"
                          style={{ width: space.value, height: space.value }}
                        />
                        <span className="text-sm text-gray-600">
                          {space.value} ({space.px})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 컴포넌트 탭 */}
          <TabsContent value="components" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>컴포넌트 미리보기</CardTitle>
                <CardDescription>
                  Design Token을 적용한 컴포넌트들의 예시
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 버튼 예시 */}
                <div>
                  <h3 className="text-text-lg font-semibold mb-3">버튼</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="default">Primary Button</Button>
                    <Button variant="secondary">Secondary Button</Button>
                    <Button variant="outline">Outline Button</Button>
                    <Button variant="ghost">Ghost Button</Button>
                  </div>
                </div>

                {/* 뱃지 예시 */}
                <div>
                  <h3 className="text-text-lg font-semibold mb-3">뱃지</h3>
                  <div className="flex flex-wrap gap-3">
                    <Badge className="bg-success-500 text-success-foreground">
                      성공
                    </Badge>
                    <Badge className="bg-warning-500 text-warning-foreground">
                      경고
                    </Badge>
                    <Badge className="bg-error-500 text-error-foreground">
                      오류
                    </Badge>
                    <Badge className="bg-info-500 text-info-foreground">
                      정보
                    </Badge>
                  </div>
                </div>

                {/* 카드 예시 */}
                <div>
                  <h3 className="text-text-lg font-semibold mb-3">카드</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-gradient-card">
                      <CardHeader>
                        <CardTitle>그라디언트 카드</CardTitle>
                        <CardDescription>
                          배경 그라디언트가 적용된 카드
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-text-sm text-gray-600">
                          Design Token을 활용한 카드 컴포넌트입니다.
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle>그림자 카드</CardTitle>
                        <CardDescription>
                          큰 그림자가 적용된 카드
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-text-sm text-gray-600">
                          깊이감을 주는 그림자 효과입니다.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
