'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  X, 
  Globe, 
  Building2, 
  Target, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Tag
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  Guideline,
  GUIDELINE_TYPES,
  GUIDELINE_SCOPES 
} from '@/types/guidelines'
import { useSites } from '@/hooks/use-sites'

interface GuidelineViewModalProps {
  isOpen: boolean
  guideline: Guideline | null
  onClose: () => void
  onEdit?: (guideline: Guideline) => void
  onDelete?: (id: string, title: string) => void
}

export function GuidelineViewModal({
  isOpen,
  guideline,
  onClose,
  onEdit,
  onDelete
}: GuidelineViewModalProps) {
  const { sites } = useSites()

  if (!isOpen || !guideline) return null

  // 지침 타입 색상 매핑
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'BUSINESS_FLOW': 'bg-blue-100 text-blue-800',
      'SEQUENCE_DIAGRAM': 'bg-purple-100 text-purple-800',
      'REQUIREMENTS': 'bg-green-100 text-green-800',
      'PROGRAM_DESIGN_ONLINE': 'bg-orange-100 text-orange-800',
      'PROGRAM_DESIGN_BATCH': 'bg-red-100 text-red-800',
      'PROGRAM_DESIGN_COMMON': 'bg-yellow-100 text-yellow-800',
      'IMPACT_ANALYSIS': 'bg-rose-100 text-rose-800',
      'TABLE_SPECIFICATION': 'bg-indigo-100 text-indigo-800',
      'INTERFACE_SPECIFICATION': 'bg-teal-100 text-teal-800',
      'GENERAL': 'bg-gray-100 text-gray-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  // 우선순위 색상
  const getPriorityColor = (priority: number) => {
    if (priority >= 100) return 'text-red-600 font-bold'
    if (priority >= 80) return 'text-orange-600 font-semibold'
    if (priority >= 60) return 'text-yellow-600'
    if (priority >= 40) return 'text-blue-600'
    return 'text-gray-600'
  }

  // 우선순위 레벨
  const getPriorityLevel = (priority: number) => {
    if (priority >= 100) return '최고'
    if (priority >= 80) return '높음'
    if (priority >= 60) return '보통'
    if (priority >= 40) return '낮음'
    return '최저'
  }

  // 사이트명 가져오기
  const getSiteName = (siteId?: string) => {
    if (!siteId) return null
    const site = sites?.find(s => s.id === siteId)
    return site?.name || siteId
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <Card className="border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Target className="h-6 w-6 text-blue-600" />
                {guideline.title}
              </CardTitle>
              <CardDescription className="mt-2">
                {guideline.description || '설명이 없습니다.'}
              </CardDescription>
              
              {/* 메타데이터 배지들 */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge className={getTypeColor(guideline.guideline_type)}>
                  {GUIDELINE_TYPES[guideline.guideline_type as keyof typeof GUIDELINE_TYPES]}
                </Badge>
                
                <Badge variant={guideline.scope === 'GLOBAL' ? 'default' : 'secondary'}>
                  {guideline.scope === 'GLOBAL' ? (
                    <>
                      <Globe className="h-3 w-3 mr-1" />
                      전역
                    </>
                  ) : (
                    <>
                      <Building2 className="h-3 w-3 mr-1" />
                      {getSiteName(guideline.site_id) || '사이트별'}
                    </>
                  )}
                </Badge>

                <Badge variant={guideline.is_active ? 'default' : 'secondary'} className={
                  guideline.is_active 
                    ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }>
                  {guideline.is_active ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      활성
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      비활성
                    </>
                  )}
                </Badge>

                <Badge variant="outline" className={getPriorityColor(guideline.priority)}>
                  우선순위: {guideline.priority} ({getPriorityLevel(guideline.priority)})
                </Badge>

                <Badge variant="outline">
                  v{guideline.version}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(guideline)}>
                  수정
                </Button>
              )}
              {onDelete && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onDelete(guideline.id, guideline.title)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  삭제
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 지침 내용 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  📋 역할 지침
                </h3>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {guideline.role_instruction}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  🎯 목표 지침
                </h3>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {guideline.objective_instruction}
                  </p>
                </div>
              </div>
            </div>

            {/* 추가 컨텍스트 */}
            {guideline.additional_context && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  📌 추가 컨텍스트
                </h3>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {guideline.additional_context}
                  </p>
                </div>
              </div>
            )}

            {/* 제약사항 및 예시 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {guideline.constraints && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    ⚠️ 제약사항
                  </h3>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {guideline.constraints}
                    </p>
                  </div>
                </div>
              )}

              {guideline.examples && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    💡 작성 예시
                  </h3>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {guideline.examples}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 참고 자료 */}
            {guideline.references && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  📚 참고 자료
                </h3>
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {guideline.references}
                  </p>
                </div>
              </div>
            )}

            {/* 태그 */}
            {guideline.tags.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  태그
                </h3>
                <div className="flex flex-wrap gap-2">
                  {guideline.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 메타 정보 */}
            <div className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <p className="font-medium">생성자</p>
                    <p>{guideline.created_by || '시스템'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <p className="font-medium">생성일</p>
                    <p>
                      {guideline.created_at 
                        ? formatDistanceToNow(new Date(guideline.created_at), { addSuffix: true, locale: ko })
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <p className="font-medium">수정자</p>
                    <p>{guideline.updated_by || '시스템'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <p className="font-medium">수정일</p>
                    <p>
                      {guideline.updated_at 
                        ? formatDistanceToNow(new Date(guideline.updated_at), { addSuffix: true, locale: ko })
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
