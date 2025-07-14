'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

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
  const [siteId, setSiteId] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);

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
    
    if (siteId) {
      formData.append('site_id', siteId);
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
    setUploading(true);
    const pendingFiles = files.filter(f => f.status === 'idle');
    
    for (const fileState of pendingFiles) {
      await uploadFile(fileState);
    }
    
    setUploading(false);
  };

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
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="siteId">사이트 ID (선택사항)</Label>
                <Input
                  id="siteId"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  placeholder="예: site-12345"
                />
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