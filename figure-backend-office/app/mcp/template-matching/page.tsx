'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import ProtectedRoute from '@/components/auth/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, Settings, Target, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

// 타입 정의
interface TemplateMatchingRule {
  id: number;
  mcp_request_type: string;
  template_type: string;
  site_id?: string;
  priority: number;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface TemplateMatchingRuleResponse {
  rule: TemplateMatchingRule;
  can_edit: boolean;
  can_delete: boolean;
}

// MCP 요청 타입 매핑
const MCP_REQUEST_TYPES = {
  'impact_analysis': '영향도 분석서',
  'requirements_doc': '요구사항 정의서',
  'api_documentation': 'API 문서',
  'deployment_guide': '배포 가이드',
  'test_plan': '테스트 계획서',
  'technical_spec': '기술 명세서',
  'user_manual': '사용자 매뉴얼',
  'release_notes': '릴리즈 노트'
};

// 템플릿 타입 매핑
const TEMPLATE_TYPES = {
  'REQUIREMENTS': '요구사항 정의서',
  'IMPACT_ANALYSIS': '영향도 분석서',
  'API_DOCUMENTATION': 'API 문서',
  'DEPLOYMENT_GUIDE': '배포 가이드',
  'TEST_PLAN': '테스트 계획서',
  'TECHNICAL_SPECIFICATION': '기술 명세서',
  'USER_MANUAL': '사용자 매뉴얼',
  'RELEASE_NOTES': '릴리즈 노트',
  'CUSTOM': '사용자 정의'
};

interface Site {
  id: string;
  name: string;
  company: string;
}

interface Template {
  id: string;
  name: string;
  template_type: string;
  site_id?: string;
}

export default function TemplateMatchingPage() {
  const [rules, setRules] = useState<TemplateMatchingRuleResponse[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<TemplateMatchingRule | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');
  const [formData, setFormData] = useState({
    mcp_request_type: '',
    template_id: '', // template_type 대신 실제 template_id 사용
    site_id: '',
    priority: 0,
    is_active: true,
    description: ''
  });

  // 매칭 규칙 목록 조회
  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/template-matching/rules');
      if (response.data.success) {
        setRules(response.data.data);
      }
    } catch (error) {
      console.error('매칭 규칙 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 사이트 목록 조회
  const fetchSites = async () => {
    try {
      const response = await api.get('/api/sites/');
      if (response.data.success) {
        setSites(response.data.data);
      }
    } catch (error) {
      console.error('사이트 목록 조회 실패:', error);
    }
  };

  // 템플릿 목록 조회 (MCP 요청 타입에 따른 필터링)
  const fetchTemplates = async (mcpRequestType?: string) => {
    try {
      const params: any = {};
      
      // MCP 요청 타입이 선택되었으면 해당 템플릿 타입으로 필터링
      if (mcpRequestType) {
        const templateTypeMap: { [key: string]: string } = {
          'impact_analysis': 'IMPACT_ANALYSIS',
          'requirements_doc': 'REQUIREMENTS',
          'api_documentation': 'API_DOCUMENTATION',
          'deployment_guide': 'DEPLOYMENT_GUIDE',
          'test_plan': 'TEST_PLAN',
          'technical_spec': 'TECHNICAL_SPECIFICATION',
          'user_manual': 'USER_MANUAL',
          'release_notes': 'RELEASE_NOTES'
        };
        
        const templateType = templateTypeMap[mcpRequestType];
        if (templateType) {
          params.template_type = templateType;
        }
      }
      
      const response = await api.get('/api/documents/', { params });
      if (response.data.success) {
        // 템플릿 타입이 있는 문서만 필터링
        const templatesFromDocs = response.data.data.documents
          .filter((doc: any) => doc.template_type)
          .map((doc: any) => ({
            id: doc.id,
            name: doc.filename || doc.title,
            template_type: doc.template_type,
            template_version: doc.template_version || '1.0.0',
            site_id: doc.site_id
          }));
        setTemplates(templatesFromDocs);
      }
    } catch (error) {
      console.error('템플릿 목록 조회 실패:', error);
    }
  };

  // 매칭 규칙 생성
  const createRule = async () => {
    try {
      // 선택된 템플릿 정보 가져오기
      const selectedTemplate = templates.find(t => t.id === formData.template_id);
      if (!selectedTemplate) {
        alert('템플릿을 선택해주세요.');
        return;
      }

      const response = await api.post('/api/template-matching/rules', {
        mcp_request_type: formData.mcp_request_type,
        template_type: selectedTemplate.template_type,
        site_id: applyToAll ? null : formData.site_id,
        priority: formData.priority,
        is_active: formData.is_active,
        description: formData.description
      });
      
      if (response.data.success) {
        await fetchRules();
        setShowCreateForm(false);
        resetForm();
        setActiveTab('rules');
      }
    } catch (error) {
      console.error('매칭 규칙 생성 실패:', error);
      alert('매칭 규칙 생성에 실패했습니다.');
    }
  };

  // 매칭 규칙 수정
  const updateRule = async () => {
    if (!editingRule) return;
    
    try {
      // 선택된 템플릿 정보 가져오기
      const selectedTemplate = templates.find(t => t.id === formData.template_id);
      if (!selectedTemplate) {
        alert('템플릿을 선택해주세요.');
        return;
      }

      const response = await api.put(`/api/template-matching/rules/${editingRule.id}`, {
        mcp_request_type: formData.mcp_request_type,
        template_type: selectedTemplate.template_type,
        site_id: applyToAll ? null : formData.site_id,
        priority: formData.priority,
        is_active: formData.is_active,
        description: formData.description
      });
      
      if (response.data.success) {
        await fetchRules();
        setEditingRule(null);
        resetForm();
        setActiveTab('rules');
      }
    } catch (error) {
      console.error('매칭 규칙 수정 실패:', error);
      alert('매칭 규칙 수정에 실패했습니다.');
    }
  };

  // 매칭 규칙 삭제
  const deleteRule = async (ruleId: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      const response = await api.delete(`/api/template-matching/rules/${ruleId}`);
      if (response.data.success) {
        await fetchRules();
      }
    } catch (error) {
      console.error('매칭 규칙 삭제 실패:', error);
      alert('매칭 규칙 삭제에 실패했습니다.');
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      mcp_request_type: '',
      template_id: '',
      site_id: '',
      priority: 0,
      is_active: true,
      description: ''
    });
    setApplyToAll(false);
  };

  // 편집 모드 시작
  const startEdit = (rule: TemplateMatchingRule) => {
    setEditingRule(rule);
    
    // 해당 템플릿 타입에 맞는 템플릿 찾기
    const matchingTemplate = templates.find(t => t.template_type === rule.template_type);
    
    setFormData({
      mcp_request_type: rule.mcp_request_type,
      template_id: matchingTemplate?.id || '',
      site_id: rule.site_id || '',
      priority: rule.priority,
      is_active: rule.is_active,
      description: rule.description || ''
    });
    
    setApplyToAll(!rule.site_id); // 사이트가 없으면 전체 적용
    setShowCreateForm(false);
    setActiveTab('form'); // 폼 탭으로 전환
  };

  // 생성 모드 시작
  const startCreate = () => {
    setShowCreateForm(true);
    setEditingRule(null);
    resetForm();
    setActiveTab('form'); // 폼 탭으로 전환
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchRules(),
        fetchSites(),
        fetchTemplates()
      ]);
    };
    loadData();
  }, []);

  // MCP 요청 타입이 변경되면 해당 타입의 템플릿만 로드
  useEffect(() => {
    if (formData.mcp_request_type) {
      fetchTemplates(formData.mcp_request_type);
      // 기존 선택된 템플릿 초기화
      setFormData(prev => ({ ...prev, template_id: '' }));
    }
  }, [formData.mcp_request_type]);

  if (loading) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="flex items-center justify-center h-96">
            <div className="text-lg">매칭 규칙을 불러오는 중...</div>
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">MCP 템플릿 매칭 관리</h1>
              <p className="text-muted-foreground">
                MCP 요청 타입과 템플릿 타입 간의 매칭 규칙을 관리합니다
              </p>
            </div>
            <Button onClick={startCreate} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              매칭 규칙 추가
            </Button>
          </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 규칙</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 규칙</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter(r => r.rule.is_active).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">비활성 규칙</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter(r => !r.rule.is_active).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">사이트별 규칙</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter(r => r.rule.site_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">매칭 규칙 목록</TabsTrigger>
          {(showCreateForm || editingRule) && (
            <TabsTrigger value="form">
              {editingRule ? '규칙 수정' : '규칙 생성'}
            </TabsTrigger>
          )}
        </TabsList>

        {/* 매칭 규칙 목록 */}
        <TabsContent value="rules" className="space-y-4">
          {rules.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  등록된 매칭 규칙이 없습니다.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rules.map((ruleResponse) => {
                const rule = ruleResponse.rule;
                return (
                  <Card key={rule.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-lg">
                            {MCP_REQUEST_TYPES[rule.mcp_request_type as keyof typeof MCP_REQUEST_TYPES] || rule.mcp_request_type}
                          </CardTitle>
                          <Badge variant={rule.is_active ? "default" : "secondary"}>
                            {rule.is_active ? "활성" : "비활성"}
                          </Badge>
                          {rule.site_id && (
                            <Badge variant="outline">사이트: {rule.site_id}</Badge>
                          )}
                          <Badge variant="outline">우선순위: {rule.priority}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(rule)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription>
                        {rule.description || '설명이 없습니다.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">MCP 요청 타입:</span>
                          <div className="text-muted-foreground">{rule.mcp_request_type}</div>
                        </div>
                        <div>
                          <span className="font-medium">매칭될 템플릿 타입:</span>
                          <div className="text-muted-foreground">
                            {TEMPLATE_TYPES[rule.template_type as keyof typeof TEMPLATE_TYPES] || rule.template_type}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">생성일:</span>
                          <div className="text-muted-foreground">
                            {new Date(rule.created_at).toLocaleString('ko-KR')}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">수정일:</span>
                          <div className="text-muted-foreground">
                            {new Date(rule.updated_at).toLocaleString('ko-KR')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 생성/수정 폼 */}
        {(showCreateForm || editingRule) && (
          <TabsContent value="form">
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingRule ? '매칭 규칙 수정' : '새 매칭 규칙 생성'}
                </CardTitle>
                <CardDescription>
                  MCP 요청 타입과 템플릿 타입 간의 매칭 규칙을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mcp_request_type">MCP 요청 타입</Label>
                    <select
                      id="mcp_request_type"
                      className="w-full p-2 border rounded-md"
                      value={formData.mcp_request_type}
                      onChange={(e) => setFormData({ ...formData, mcp_request_type: e.target.value })}
                    >
                      <option value="">선택하세요</option>
                      {Object.entries(MCP_REQUEST_TYPES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="template_id">템플릿 선택</Label>
                    <select
                      id="template_id"
                      className="w-full p-2 border rounded-md"
                      value={formData.template_id}
                      onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                    >
                      <option value="">선택하세요</option>
                      {templates.length === 0 ? (
                        <option value="" disabled>등록된 템플릿이 없습니다</option>
                      ) : (
                        templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({TEMPLATE_TYPES[template.template_type as keyof typeof TEMPLATE_TYPES] || template.template_type})
                            {template.site_id && ` - ${template.site_id}`}
                          </option>
                        ))
                      )}
                    </select>
                    {templates.length === 0 && (
                      <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded-md">
                        ⚠️ 등록된 템플릿이 없습니다. 
                        <a href="/documents/upload" className="text-orange-800 underline ml-1">
                          템플릿을 먼저 업로드해주세요
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* 전체 적용 체크박스 */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="apply_to_all"
                      checked={applyToAll}
                      onChange={(e) => {
                        setApplyToAll(e.target.checked);
                        if (e.target.checked) {
                          setFormData({ ...formData, site_id: '' });
                        }
                      }}
                    />
                    <Label htmlFor="apply_to_all">모든 사이트에 적용</Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="site_id">사이트 선택</Label>
                    <select
                      id="site_id"
                      className="w-full p-2 border rounded-md"
                      value={formData.site_id}
                      onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                      disabled={applyToAll}
                    >
                      <option value="">사이트를 선택하세요</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name} ({site.company})
                        </option>
                      ))}
                    </select>
                    {sites.length === 0 && (
                      <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded-md">
                        ⚠️ 등록된 사이트가 없습니다. 
                        <a href="/sites" className="text-orange-800 underline ml-1">
                          사이트를 먼저 등록해주세요
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority">우선순위</Label>
                    <Input
                      id="priority"
                      type="number"
                      placeholder="0"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    />
                    <div className="text-xs text-gray-500">
                      높을수록 우선 적용됩니다
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">설명</Label>
                  <Textarea
                    id="description"
                    placeholder="매칭 규칙에 대한 설명을 입력하세요"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <Label htmlFor="is_active">활성화</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingRule(null);
                      resetForm();
                      setActiveTab('rules');
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={editingRule ? updateRule : createRule}
                    disabled={
                      !formData.mcp_request_type || 
                      !formData.template_id || 
                      (!applyToAll && !formData.site_id)
                    }
                  >
                    {editingRule ? '수정' : '생성'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
        </Tabs>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
