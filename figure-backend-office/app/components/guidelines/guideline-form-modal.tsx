'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Save, AlertCircle, Info, Target, Plus, Trash2 } from 'lucide-react'
import { 
  Guideline, 
  GuidelineCreateRequest, 
  GuidelineUpdateRequest,
  GuidelineType,
  GuidelineScope,
  GUIDELINE_TYPES,
  GUIDELINE_SCOPES,
  GUIDELINE_PRIORITIES 
} from '@/types/guidelines'
import { useSites } from '@/hooks/use-sites'

interface GuidelineFormModalProps {
  isOpen: boolean
  editingGuideline?: Guideline | null
  onClose: () => void
  onSubmit: (data: GuidelineCreateRequest | { id: string; data: GuidelineUpdateRequest }) => void
  isLoading: boolean
  error?: Error | null
}

export function GuidelineFormModal({
  isOpen,
  editingGuideline,
  onClose,
  onSubmit,
  isLoading,
  error
}: GuidelineFormModalProps) {
  const { sites } = useSites()
  const [formData, setFormData] = useState<{
    title: string
    description: string
    guideline_type: GuidelineType | ''
    scope: GuidelineScope
    site_id: string
    role_instruction: string
    objective_instruction: string
    additional_context: string
    priority: number
    constraints: string
    examples: string
    references: string
    tags: string[]
    is_active: boolean
  }>({
    title: '',
    description: '',
    guideline_type: '',
    scope: 'GLOBAL',
    site_id: '',
    role_instruction: '',
    objective_instruction: '',
    additional_context: '',
    priority: 60,
    constraints: '',
    examples: '',
    references: '',
    tags: [],
    is_active: true
  })

  const [newTag, setNewTag] = useState('')

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (editingGuideline) {
      setFormData({
        title: editingGuideline.title,
        description: editingGuideline.description || '',
        guideline_type: editingGuideline.guideline_type,
        scope: editingGuideline.scope,
        site_id: editingGuideline.site_id || '',
        role_instruction: editingGuideline.role_instruction,
        objective_instruction: editingGuideline.objective_instruction,
        additional_context: editingGuideline.additional_context || '',
        priority: editingGuideline.priority,
        constraints: editingGuideline.constraints || '',
        examples: editingGuideline.examples || '',
        references: editingGuideline.references || '',
        tags: [...editingGuideline.tags],
        is_active: editingGuideline.is_active
      })
    } else {
      // 새 지침 생성 시 초기값
      setFormData({
        title: '',
        description: '',
        guideline_type: '',
        scope: 'GLOBAL',
        site_id: '',
        role_instruction: '',
        objective_instruction: '',
        additional_context: '',
        priority: 60,
        constraints: '',
        examples: '',
        references: '',
        tags: [],
        is_active: true
      })
    }
  }, [editingGuideline])

  // 모달 닫기
  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      guideline_type: '',
      scope: 'GLOBAL',
      site_id: '',
      role_instruction: '',
      objective_instruction: '',
      additional_context: '',
      priority: 60,
      constraints: '',
      examples: '',
      references: '',
      tags: [],
      is_active: true
    })
    setNewTag('')
    onClose()
  }

  // 폼 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.guideline_type || !formData.role_instruction || !formData.objective_instruction) {
      alert('필수 필드를 모두 입력해주세요.')
      return
    }

    const submitData = {
      title: formData.title,
      description: formData.description || undefined,
      guideline_type: formData.guideline_type as GuidelineType,
      scope: formData.scope,
      site_id: formData.scope === 'SITE_SPECIFIC' ? formData.site_id || undefined : undefined,
      role_instruction: formData.role_instruction,
      objective_instruction: formData.objective_instruction,
      additional_context: formData.additional_context || undefined,
      priority: formData.priority,
      constraints: formData.constraints || undefined,
      examples: formData.examples || undefined,
      references: formData.references || undefined,
      tags: formData.tags,
      is_active: formData.is_active
    }

    if (editingGuideline) {
      onSubmit({ id: editingGuideline.id, data: submitData })
    } else {
      onSubmit(submitData)
    }
  }

  // 태그 추가
  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  // 태그 제거
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  // 우선순위 색상
  const getPriorityColor = (priority: number) => {
    if (priority >= 100) return 'text-red-600'
    if (priority >= 80) return 'text-orange-600'
    if (priority >= 60) return 'text-yellow-600'
    if (priority >= 40) return 'text-blue-600'
    return 'text-gray-600'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <Card className="border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                {editingGuideline ? '지침 수정' : '새 지침 추가'}
              </CardTitle>
              <CardDescription>
                {editingGuideline ? '기존 지침 내용을 수정합니다.' : 'LLM이 문서 생성 시 따를 새로운 지침을 추가합니다.'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">제목 *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 요구사항정의서 작성 지침"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="guideline_type">문서 타입 *</Label>
                  <select
                    id="guideline_type"
                    value={formData.guideline_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, guideline_type: e.target.value as GuidelineType }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">문서 타입 선택</option>
                    {Object.entries(GUIDELINE_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="이 지침의 목적과 사용 범위를 설명해주세요"
                  rows={2}
                />
              </div>

              {/* 범위 및 우선순위 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scope">적용 범위 *</Label>
                  <select
                    id="scope"
                    value={formData.scope}
                    onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value as GuidelineScope }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(GUIDELINE_SCOPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {formData.scope === 'SITE_SPECIFIC' && (
                  <div className="space-y-2">
                    <Label htmlFor="site_id">사이트</Label>
                    <select
                      id="site_id"
                      value={formData.site_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, site_id: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">사이트 선택</option>
                      {sites?.map(site => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="priority">우선순위 *</Label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {GUIDELINE_PRIORITIES.map(({ value, label, color }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <p className={`text-sm ${getPriorityColor(formData.priority)}`}>
                    현재: {GUIDELINE_PRIORITIES.find(p => p.value === formData.priority)?.label}
                  </p>
                </div>
              </div>

              {/* 지침 내용 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">지침 내용</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role_instruction">📋 역할 지침 *</Label>
                  <Textarea
                    id="role_instruction"
                    value={formData.role_instruction}
                    onChange={(e) => setFormData(prev => ({ ...prev, role_instruction: e.target.value }))}
                    placeholder="예: 당신은 전문적인 요구사항 분석가입니다. 명확하고 구체적인 요구사항을 작성하세요."
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objective_instruction">🎯 목표 지침 *</Label>
                  <Textarea
                    id="objective_instruction"
                    value={formData.objective_instruction}
                    onChange={(e) => setFormData(prev => ({ ...prev, objective_instruction: e.target.value }))}
                    placeholder="예: 사용자 요구사항을 분석하여 개발팀이 이해하기 쉬운 명세서를 작성하는 것이 목표입니다."
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additional_context">📌 추가 컨텍스트</Label>
                  <Textarea
                    id="additional_context"
                    value={formData.additional_context}
                    onChange={(e) => setFormData(prev => ({ ...prev, additional_context: e.target.value }))}
                    placeholder="추가적인 배경 정보나 컨텍스트를 입력하세요"
                    rows={2}
                  />
                </div>
              </div>

              {/* 제약사항 및 예시 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="constraints">⚠️ 제약사항</Label>
                  <Textarea
                    id="constraints"
                    value={formData.constraints}
                    onChange={(e) => setFormData(prev => ({ ...prev, constraints: e.target.value }))}
                    placeholder="예: 명확한 수용 기준 포함 필수"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="examples">💡 작성 예시</Label>
                  <Textarea
                    id="examples"
                    value={formData.examples}
                    onChange={(e) => setFormData(prev => ({ ...prev, examples: e.target.value }))}
                    placeholder="예: 기능요구사항, 비기능요구사항 분리 작성"
                    rows={3}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="references">📚 참고 자료</Label>
                <Textarea
                  id="references"
                  value={formData.references}
                  onChange={(e) => setFormData(prev => ({ ...prev, references: e.target.value }))}
                  placeholder="관련 문서, 링크, 표준 등을 입력하세요"
                  rows={2}
                />
              </div>

              {/* 태그 */}
              <div className="space-y-2">
                <Label>🏷️ 태그</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="태그 입력"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 활성 상태 */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="is_active">지침 활성화</Label>
              </div>

              {/* 에러 표시 */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span>오류: {error.message}</span>
                </div>
              )}

              {/* 버튼 */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>
                  취소
                </Button>
                <Button type="submit" disabled={isLoading} className="flex items-center gap-2">
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingGuideline ? '수정' : '추가'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
