// Interface Layer - 파일 업로드 UI 컴포넌트

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { DocumentUploadUseCase } from '@/lib/application/document-upload-use-case';
import { DocumentUploadServiceFactory } from '@/lib/infrastructure/document-upload-service';
import { UploadStatus, UploadResult } from '@/lib/domain/document-upload';

interface FileUploadZoneProps {
  onUploadSuccess?: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
  defaultSiteId?: string;
  maxFiles?: number;
  disabled?: boolean;
}

interface FileUploadState {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  message: string;
  result?: UploadResult;
  error?: string;
}

export default function FileUploadZone({
  onUploadSuccess,
  onUploadError,
  defaultSiteId,
  maxFiles = 5,
  disabled = false
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [siteId, setSiteId] = useState(defaultSiteId || '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 헥사고날 아키텍처 - 의존성 주입
  const uploadUseCase = new DocumentUploadUseCase(
    DocumentUploadServiceFactory.createService('api'),
    {
      handle: (event) => {
        console.log('Upload event:', event);
        // 이벤트 처리 로직 (예: 로깅, 알림 등)
      }
    }
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(selectedFiles);
  }, []);

  const handleFiles = useCallback((newFiles: File[]) => {
    if (disabled) return;

    const filteredFiles = newFiles.filter(file => {
      const validation = uploadUseCase.validateFile(file);
      return validation.isValid;
    });

    const remainingSlots = maxFiles - files.length;
    const filesToAdd = filteredFiles.slice(0, remainingSlots);

    const newFileStates: FileUploadState[] = filesToAdd.map(file => ({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      file,
      progress: 0,
      status: UploadStatus.IDLE,
      message: '대기 중'
    }));

    setFiles(prev => [...prev, ...newFileStates]);
  }, [files.length, maxFiles, disabled, uploadUseCase]);

  const uploadFile = useCallback(async (fileState: FileUploadState) => {
    const metadata = {
      siteId: siteId || undefined,
      description: description || undefined,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean)
    };

    // 진행 상태 업데이트
    setFiles(prev => prev.map(f => 
      f.id === fileState.id 
        ? { ...f, status: UploadStatus.VALIDATING, message: '파일 검증 중...', progress: 10 }
        : f
    ));

    try {
      const result = await uploadUseCase.uploadDocument(fileState.file, metadata);

      if (result.success) {
        setFiles(prev => prev.map(f => 
          f.id === fileState.id 
            ? { ...f, status: UploadStatus.SUCCESS, message: '업로드 완료', progress: 100, result }
            : f
        ));
        onUploadSuccess?.(result);
      } else {
        setFiles(prev => prev.map(f => 
          f.id === fileState.id 
            ? { ...f, status: UploadStatus.ERROR, message: result.error || '업로드 실패', progress: 0, error: result.error }
            : f
        ));
        onUploadError?.(result.error || '업로드 실패');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      setFiles(prev => prev.map(f => 
        f.id === fileState.id 
          ? { ...f, status: UploadStatus.ERROR, message: errorMessage, progress: 0, error: errorMessage }
          : f
      ));
      onUploadError?.(errorMessage);
    }
  }, [siteId, description, tags, uploadUseCase, onUploadSuccess, onUploadError]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const uploadAllFiles = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === UploadStatus.IDLE);
    
    for (const fileState of pendingFiles) {
      await uploadFile(fileState);
    }
  }, [files, uploadFile]);

  const clearAllFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case UploadStatus.IDLE:
        return <FileText className="h-4 w-4" />;
      case UploadStatus.VALIDATING:
      case UploadStatus.UPLOADING:
      case UploadStatus.PROCESSING:
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case UploadStatus.SUCCESS:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case UploadStatus.ERROR:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: UploadStatus) => {
    const statusConfig = {
      [UploadStatus.IDLE]: { label: '대기', variant: 'secondary' as const },
      [UploadStatus.VALIDATING]: { label: '검증 중', variant: 'default' as const },
      [UploadStatus.UPLOADING]: { label: '업로드 중', variant: 'default' as const },
      [UploadStatus.PROCESSING]: { label: '처리 중', variant: 'default' as const },
      [UploadStatus.SUCCESS]: { label: '완료', variant: 'default' as const },
      [UploadStatus.ERROR]: { label: '오류', variant: 'destructive' as const }
    };

    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 업로드 메타데이터 */}
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
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="tags">태그 (쉼표로 구분)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="예: 가이드, 튜토리얼, 중요"
                disabled={disabled}
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
              disabled={disabled}
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
                ? 'border-primary bg-primary/10'
                : 'border-gray-300 hover:border-primary/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">파일을 드래그하여 업로드하거나 클릭하여 선택하세요</p>
            <p className="text-sm text-gray-500">
              지원 형식: .txt, .md, .pdf, .doc, .docx, .html, .htm (최대 10MB)
            </p>
            <p className="text-sm text-gray-500">
              최대 {maxFiles}개 파일까지 업로드 가능
            </p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.pdf,.doc,.docx,.html,.htm"
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
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
                disabled={disabled || files.every(f => f.status !== UploadStatus.IDLE)}
                size="sm"
              >
                전체 업로드
              </Button>
              <Button
                onClick={clearAllFiles}
                variant="outline"
                size="sm"
                disabled={disabled}
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
                      <span>{uploadUseCase.formatFileSize(fileState.file.size)}</span>
                      <span>•</span>
                      <span>{fileState.message}</span>
                    </div>
                    
                    {fileState.status !== UploadStatus.IDLE && fileState.status !== UploadStatus.ERROR && (
                      <div className="mt-2">
                        <Progress value={fileState.progress} className="h-2" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {fileState.status === UploadStatus.IDLE && (
                      <Button
                        onClick={() => uploadFile(fileState)}
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                      >
                        업로드
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => removeFile(fileState.id)}
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
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
    </div>
  );
} 