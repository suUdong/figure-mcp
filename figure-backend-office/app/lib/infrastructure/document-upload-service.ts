// Infrastructure Layer - 문서 업로드 서비스 구현

import { DocumentUploadService, DocumentUploadEntity, UploadResult, UploadProgress, UploadStatus } from '../domain/document-upload';
import { api as apiClient } from '../api';

export class ApiDocumentUploadService implements DocumentUploadService {
  private activeUploads = new Map<string, AbortController>();

  async uploadDocument(entity: DocumentUploadEntity): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', entity.file.content);
    
    if (entity.metadata.siteId) {
      formData.append('site_id', entity.metadata.siteId);
    }
    
    formData.append('metadata', JSON.stringify({
      tags: entity.metadata.tags || [],
      description: entity.metadata.description || '',
      ...entity.metadata.customFields
    }));

    const abortController = new AbortController();
    this.activeUploads.set(entity.file.id, abortController);

    try {
      const response = await apiClient.post('/api/documents/upload-file', formData, {
        headers: {
          // Content-Type 제거 - axios가 자동으로 boundary와 함께 설정
        },
        signal: abortController.signal,
        timeout: 300000, // 5분 타임아웃
      });

      this.activeUploads.delete(entity.file.id);

      if (response.data.success) {
        return {
          success: true,
          documentId: response.data.data.document_id,
          jobId: response.data.data.job_id,
          filename: response.data.data.filename,
          message: response.data.message
        };
      } else {
        return {
          success: false,
          error: response.data.message || '업로드 실패'
        };
      }
    } catch (error: any) {
      this.activeUploads.delete(entity.file.id);

      if (error?.name === 'AbortError') {
        return {
          success: false,
          error: '업로드가 취소되었습니다.'
        };
      }

      // 에러 메시지 안전하게 추출 (객체인 경우 JSON 변환)
      let errorMessage = '업로드 중 오류가 발생했습니다.';
      
      try {
        const errorDetail = error?.response?.data?.detail;
        if (typeof errorDetail === 'string') {
          errorMessage = errorDetail;
        } else if (typeof errorDetail === 'object' && errorDetail) {
          // 배열인 경우 (FastAPI 422 에러)
          if (Array.isArray(errorDetail)) {
            errorMessage = errorDetail.map(err => err.msg || err).join(', ');
          } else {
            errorMessage = JSON.stringify(errorDetail);
          }
        } else if (error?.message) {
          errorMessage = error.message;
        }
      } catch (e) {
        console.error('Error parsing error message:', e);
        errorMessage = "업로드 실패 (에러 메시지 파싱 실패)";
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getUploadProgress(jobId: string): Promise<UploadProgress> {
    try {
      const response = await apiClient.get(`/admin/jobs/${jobId}`);
      
      if (response.data.success) {
        const job = response.data.data;
        return {
          percentage: job.progress || 0,
          message: job.message || '처리 중...',
          status: this.mapJobStatusToUploadStatus(job.status)
        };
      } else {
        throw new Error('작업 정보를 가져올 수 없습니다.');
      }
    } catch (error: any) {
      throw new Error(`진행 상태 조회 실패: ${error?.message}`);
    }
  }

  async cancelUpload(jobId: string): Promise<void> {
    try {
      // 활성 업로드가 있으면 취소
      this.activeUploads.forEach((controller) => {
        controller.abort();
      });
      
      // 백엔드 작업 취소
      await apiClient.delete(`/admin/jobs/${jobId}`);
    } catch (error: any) {
      throw new Error(`업로드 취소 실패: ${error?.message}`);
    }
  }

  private mapJobStatusToUploadStatus(jobStatus: string): UploadStatus {
    switch (jobStatus) {
      case 'pending':
        return UploadStatus.IDLE;
      case 'processing':
        return UploadStatus.UPLOADING;
      case 'completed':
        return UploadStatus.SUCCESS;
      case 'failed':
        return UploadStatus.ERROR;
      default:
        return UploadStatus.IDLE;
    }
  }
}

// 모의 서비스 (테스트용)
export class MockDocumentUploadService implements DocumentUploadService {
  async uploadDocument(entity: DocumentUploadEntity): Promise<UploadResult> {
    // 실제 업로드 시뮬레이션
    await this.delay(2000);
    
    // 성공 시뮬레이션
    if (Math.random() > 0.1) { // 90% 성공률
      return {
        success: true,
        documentId: `mock-doc-${Date.now()}`,
        jobId: `mock-job-${Date.now()}`,
        filename: entity.file.name,
        message: '업로드 성공'
      };
    } else {
      return {
        success: false,
        error: '모의 업로드 실패'
      };
    }
  }

  async getUploadProgress(jobId: string): Promise<UploadProgress> {
    return {
      percentage: 50,
      message: '처리 중...',
      status: UploadStatus.UPLOADING
    };
  }

  async cancelUpload(jobId: string): Promise<void> {
    // 취소 시뮬레이션
    await this.delay(500);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 로컬 스토리지 서비스 (추후 확장 가능)
export class LocalStorageDocumentUploadService implements DocumentUploadService {
  async uploadDocument(entity: DocumentUploadEntity): Promise<UploadResult> {
    try {
      // 로컬 스토리지에 파일 정보 저장
      const fileData = {
        id: entity.file.id,
        name: entity.file.name,
        size: entity.file.size,
        type: entity.file.type,
        uploadedAt: new Date().toISOString(),
        metadata: entity.metadata
      };

      const existingFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
      existingFiles.push(fileData);
      localStorage.setItem('uploadedFiles', JSON.stringify(existingFiles));

      return {
        success: true,
        documentId: entity.file.id,
        filename: entity.file.name,
        message: '로컬 저장 완료'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `로컬 저장 실패: ${error?.message}`
      };
    }
  }

  async getUploadProgress(jobId: string): Promise<UploadProgress> {
    return {
      percentage: 100,
      message: '완료',
      status: UploadStatus.SUCCESS
    };
  }

  async cancelUpload(jobId: string): Promise<void> {
    // 로컬 스토리지에서는 취소 기능 없음
  }
}

// 서비스 팩토리
export class DocumentUploadServiceFactory {
  static createApiService(): DocumentUploadService {
    return new ApiDocumentUploadService();
  }

  static createMockService(): DocumentUploadService {
    return new MockDocumentUploadService();
  }

  static createLocalStorageService(): DocumentUploadService {
    return new LocalStorageDocumentUploadService();
  }

  static createService(type: 'api' | 'mock' | 'localStorage' = 'api'): DocumentUploadService {
    switch (type) {
      case 'api':
        return new ApiDocumentUploadService();
      case 'mock':
        return new MockDocumentUploadService();
      case 'localStorage':
        return new LocalStorageDocumentUploadService();
      default:
        return new ApiDocumentUploadService();
    }
  }
} 