// Application Layer - 문서 업로드 유스케이스

import { 
  DocumentUploadEntity, 
  DocumentUploadService, 
  DocumentUploadEventHandler,
  DocumentUploadEvent,
  UploadResult,
  UploadStatus,
  DocumentFile,
  UploadMetadata,
  DocumentType
} from '../domain/document-upload';

export class DocumentUploadUseCase {
  constructor(
    private readonly documentUploadService: DocumentUploadService,
    private readonly eventHandler?: DocumentUploadEventHandler
  ) {}

  // 파일 업로드 실행
  async uploadDocument(
    file: File,
    metadata: UploadMetadata = {}
  ): Promise<UploadResult> {
    // 1. 도메인 엔티티 생성
    const documentFile: DocumentFile = {
      id: this.generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      content: file,
      documentType: this.inferDocumentType(file.name)
    };

    let entity = new DocumentUploadEntity(documentFile, metadata);

    try {
      // 2. 파일 검증
      entity = entity.updateProgress({
        status: UploadStatus.VALIDATING,
        percentage: 10,
        message: '파일 검증 중...'
      });

      this.emitEvent({
        type: 'upload_started',
        documentId: entity.file.id,
        data: { filename: entity.file.name }
      });

      const validation = entity.validate();
      if (!validation.isValid) {
        entity = entity.updateProgress({
          status: UploadStatus.ERROR,
          percentage: 0,
          message: validation.errors.join(', ')
        });

        this.emitEvent({
          type: 'upload_failed',
          documentId: entity.file.id,
          data: { errors: validation.errors }
        });

        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // 3. 업로드 실행
      entity = entity.updateProgress({
        status: UploadStatus.UPLOADING,
        percentage: 20,
        message: '파일 업로드 중...'
      });

      const result = await this.documentUploadService.uploadDocument(entity);

      if (result.success) {
        entity = entity.updateProgress({
          status: UploadStatus.SUCCESS,
          percentage: 100,
          message: '업로드 완료'
        });

        this.emitEvent({
          type: 'upload_completed',
          documentId: entity.file.id,
          data: result
        });
      } else {
        entity = entity.updateProgress({
          status: UploadStatus.ERROR,
          percentage: 0,
          message: result.error || '업로드 실패'
        });

        this.emitEvent({
          type: 'upload_failed',
          documentId: entity.file.id,
          data: { error: result.error }
        });
      }

      return result;

    } catch (error) {
      entity = entity.updateProgress({
        status: UploadStatus.ERROR,
        percentage: 0,
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      });

      this.emitEvent({
        type: 'upload_failed',
        documentId: entity.file.id,
        data: { error: error instanceof Error ? error.message : '알 수 없는 오류' }
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    }
  }

  // 다중 파일 업로드
  async uploadMultipleDocuments(
    files: File[],
    metadata: UploadMetadata = {}
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadDocument(file, metadata);
      results.push(result);
    }

    return results;
  }

  // 업로드 진행 상태 조회
  async getUploadProgress(jobId: string) {
    return await this.documentUploadService.getUploadProgress(jobId);
  }

  // 업로드 취소
  async cancelUpload(jobId: string) {
    await this.documentUploadService.cancelUpload(jobId);
  }

  // 파일 검증
  validateFile(file: File): { isValid: boolean; errors: string[] } {
    const documentFile: DocumentFile = {
      id: this.generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      content: file,
      documentType: this.inferDocumentType(file.name)
    };

    const entity = new DocumentUploadEntity(documentFile);
    return entity.validate();
  }

  // 지원 파일 형식 확인
  isSupportedFileType(filename: string): boolean {
    const supportedTypes = ['.txt', '.md', '.pdf', '.doc', '.docx', '.html', '.htm'];
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return supportedTypes.includes(ext);
  }

  // 파일 크기 포맷팅
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 업로드 예상 시간 계산
  estimateUploadTime(fileSize: number): string {
    // 평균 업로드 속도를 1MB/s로 가정
    const avgSpeed = 1024 * 1024; // 1MB/s
    const seconds = fileSize / avgSpeed;
    
    if (seconds < 60) {
      return `약 ${Math.ceil(seconds)}초`;
    } else if (seconds < 3600) {
      return `약 ${Math.ceil(seconds / 60)}분`;
    } else {
      return `약 ${Math.ceil(seconds / 3600)}시간`;
    }
  }

  // 파일 타입 추론
  private inferDocumentType(filename: string): DocumentType {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    
    if (['.txt', '.md'].includes(ext)) {
      return DocumentType.TEXT;
    } else if (ext === '.pdf') {
      return DocumentType.PDF;
    } else if (['.doc', '.docx'].includes(ext)) {
      return DocumentType.DOC;
    } else if (['.html', '.htm'].includes(ext)) {
      return DocumentType.WEBSITE;
    }
    
    return DocumentType.TEXT; // 기본값
  }

  // 고유 ID 생성
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 이벤트 발행
  private emitEvent(event: DocumentUploadEvent) {
    if (this.eventHandler) {
      this.eventHandler.handle(event);
    }
  }
}

// 유스케이스 팩토리
export class DocumentUploadUseCaseFactory {
  static create(
    documentUploadService: DocumentUploadService,
    eventHandler?: DocumentUploadEventHandler
  ): DocumentUploadUseCase {
    return new DocumentUploadUseCase(documentUploadService, eventHandler);
  }
} 