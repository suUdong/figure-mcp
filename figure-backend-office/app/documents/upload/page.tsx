'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, X, FileText, CheckCircle, AlertCircle, Loader2, Building2, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useSites } from '@/hooks/use-sites';

interface FileUploadState {
  id: string;
  file: File;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  message: string;
  result?: any;
}

export default function DocumentUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [showSiteDropdown, setShowSiteDropdown] = useState(false)
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);

  // 등록된 회사 목록 가져오기
  const { sites, isLoading: sitesLoading } = useSites()

  // 선택된 사이트 정보
  const selectedSite = sites?.find(site => site.id === selectedSiteId)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles: File[]) => {
    const supportedTypes = ['.txt', '.md', '.pdf', '.doc', '.docx', '.html', '.htm'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles = newFiles.filter(file => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!supportedTypes.includes(ext)) {
        alert(`지원하지 않는 파일 형식입니다: ${file.name}`);
        return false;
      }
      if (file.size > maxSize) {
        alert(`파일 크기가 10MB를 초과합니다: ${file.name}`);
        return false;
      }
      return true;
    });

    const newFileStates: FileUploadState[] = validFiles.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'idle',
      message: '업로드 대기 중'
    }));

    setFiles(prev => [...prev, ...newFileStates]);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFile = async (fileState: FileUploadState) => {
    const formData = new FormData();
    formData.append('file', fileState.file);
    
    if (selectedSiteId) {
      formData.append('site_id', selectedSiteId);
    }
    
    const metadata = {
      description: description || '',
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean)
    };
    formData.append('metadata', JSON.stringify(metadata));

    // 진행 상태 업데이트
    setFiles(prev => prev.map(f => 
      f.id === fileState.id 
        ? { ...f, status: 'uploading', message: '업로드 중...', progress: 10 }
        : f
    ));

    try {
      const response = await api.post('/api/documents/upload-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setFiles(prev => prev.map(f => 
              f.id === fileState.id 
                ? { ...f, progress: percentCompleted }
                : f
            ));
          }
        }
      });

      if (response.data.success) {
        setFiles(prev => prev.map(f => 
          f.id === fileState.id 
            ? { 
                ...f, 
                status: 'success', 
                message: '업로드 완료', 
                progress: 100,
                result: response.data.data 
              }
            : f
        ));
      } else {
        throw new Error(response.data.message || '업로드 실패');
      }
    } catch (error: any) {
      console.error('업로드 오류:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileState.id 
          ? { 
              ...f, 
              status: 'error', 
              message: error?.response?.data?.detail || error?.message || '업로드 실패',
              progress: 0 
            }
          : f
      ));
    }
  };

  const uploadAllFiles = async () => {
    // 회사 선택 여부 체크
    if (!selectedSiteId) {
      alert('문서를 등록할 회사를 선택해주세요.');
      return;
    }

    setUploading(true);
    const pendingFiles = files.filter(f => f.status === 'idle');
    
    for (const fileState of pendingFiles) {
      await uploadFile(fileState);
    }
    
    setUploading(false);
  };

  // 드롭다운 외부 클릭 시 닫기
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Element;
    if (!target.closest('.site-dropdown')) {
      setShowSiteDropdown(false);
    }
  }, []);

  // 컴포넌트 마운트 시 이벤트 리스너 등록
  React.useEffect(() => {
    if (showSiteDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSiteDropdown, handleClickOutside]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return <FileText className="h-4 w-4" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      idle: { label: '대기', variant: 'secondary' as const },
      uploading: { label: '업로드 중', variant: 'default' as const },
      success: { label: '완료', variant: 'default' as const },
      error: { label: '오류', variant: 'destructive' as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.idle;
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => router.push('/documents')}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>문서 목록으로</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">문서 업로드</h1>
              <p className="text-gray-600 mt-1">로컬 파일을 업로드하여 벡터 데이터베이스에 저장합니다</p>
            </div>
          </div>
        </div>

        {/* 업로드 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>업로드 설정</CardTitle>
            <CardDescription>문서를 등록할 회사를 선택하고 추가 정보를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 회사 선택 드롭다운 */}
              <div className="space-y-2">
                <Label htmlFor="siteSelect">등록할 회사 선택 *</Label>
                <div className="relative site-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowSiteDropdown(!showSiteDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={sitesLoading}
                  >
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className={selectedSite ? "text-gray-900" : "text-gray-500"}>
                        {selectedSite ? (
                          <span>
                            {selectedSite.name}
                            {selectedSite.department && (
                              <span className="text-gray-500"> ({selectedSite.department})</span>
                            )}
                          </span>
                        ) : sitesLoading ? "로딩 중..." : "회사를 선택하세요"}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                  
                  {/* 드롭다운 메뉴 */}
                  {showSiteDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {sitesLoading ? (
                        <div className="px-3 py-2 text-gray-500">로딩 중...</div>
                      ) : sites && sites.length > 0 ? (
                        sites.map((site) => (
                          <button
                            key={site.id}
                            type="button"
                            onClick={() => {
                              setSelectedSiteId(site.id)
                              setShowSiteDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                          >
                            <div className="flex items-center justify-between">
              <div>
                                <div className="font-medium text-gray-900">{site.name}</div>
                                <div className="text-sm text-gray-500">
                                  {site.company}
                                  {site.department && ` • ${site.department}`}
                                  {site.business_type && ` • ${site.business_type}`}
                                </div>
                              </div>
                              {site.id === selectedSiteId && (
                                <CheckCircle className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-gray-500">
                          등록된 회사가 없습니다. 
                          <button
                            onClick={() => router.push('/sites')}
                            className="ml-1 text-blue-600 hover:text-blue-800 underline"
                          >
                            회사를 먼저 등록하세요
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 선택된 회사 정보 표시 */}
                {selectedSite && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm">
                      <div className="font-medium text-blue-900">{selectedSite.company}</div>
                      {selectedSite.business_type && (
                        <div className="text-blue-700">{selectedSite.business_type}</div>
                      )}
                      {selectedSite.contact_person && (
                        <div className="text-blue-600">담당자: {selectedSite.contact_person}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="tags">태그 (쉼표로 구분)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="예: 가이드, 튜토리얼, 중요"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">설명 (선택사항)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="파일에 대한 간단한 설명을 입력하세요..."
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* 파일 드롭 영역 */}
        <Card>
          <CardHeader>
            <CardTitle>파일 업로드</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              } cursor-pointer`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg mb-2">파일을 드래그하여 업로드하거나 클릭하여 선택하세요</p>
              <p className="text-sm text-gray-500">
                지원 형식: .txt, .md, .pdf, .doc, .docx, .html, .htm (최대 10MB)
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.pdf,.doc,.docx,.html,.htm"
              onChange={handleFileSelect}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* 파일 목록 */}
        {files.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>업로드할 파일 ({files.length})</CardTitle>
              <div className="flex space-x-2">
                <Button
                  onClick={uploadAllFiles}
                  disabled={uploading || files.every(f => f.status !== 'idle')}
                  size="sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    '전체 업로드'
                  )}
                </Button>
                <Button
                  onClick={() => setFiles([])}
                  variant="outline"
                  size="sm"
                >
                  전체 삭제
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {files.map((fileState) => (
                  <div
                    key={fileState.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(fileState.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">
                          {fileState.file.name}
                        </p>
                        {getStatusBadge(fileState.status)}
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{formatFileSize(fileState.file.size)}</span>
                        <span>•</span>
                        <span>{fileState.message}</span>
                      </div>
                      
                      {fileState.status === 'uploading' && (
                        <div className="mt-2">
                          <Progress value={fileState.progress} className="h-2" />
                        </div>
                      )}

                      {fileState.status === 'success' && fileState.result && (
                        <div className="mt-2 text-xs text-green-600">
                          문서 ID: {fileState.result.document_id}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {fileState.status === 'idle' && (
                        <Button
                          onClick={() => uploadFile(fileState)}
                          size="sm"
                          variant="outline"
                          disabled={uploading}
                        >
                          업로드
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => removeFile(fileState.id)}
                        size="sm"
                        variant="ghost"
                        disabled={fileState.status === 'uploading'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 업로드 가이드 */}
        <Card>
          <CardHeader>
            <CardTitle>업로드 가이드</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium mb-2">지원하는 파일 형식</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 텍스트 파일: .txt, .md</li>
                  <li>• 문서 파일: .pdf, .doc, .docx</li>
                  <li>• 웹 파일: .html, .htm</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">업로드 제한</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 최대 파일 크기: 10MB</li>
                  <li>• 파일명은 한글과 영문 지원</li>
                  <li>• 동시 업로드 가능</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">업로드 프로세스</h4>
                <ol className="text-sm text-gray-600 space-y-1">
                  <li>1. 파일 검증</li>
                  <li>2. 서버 전송</li>
                  <li>3. 내용 추출</li>
                  <li>4. 벡터화</li>
                  <li>5. 저장 완료</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
} 