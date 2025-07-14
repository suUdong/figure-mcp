// Domain Layer - 문서 업로드 도메인 엔티티와 비즈니스 로직

export enum DocumentType {
  TEXT = 'text',
  PDF = 'pdf',
  DOC = 'doc',
  WEBSITE = 'website'
}

export enum UploadStatus {
  IDLE = 'idle',
  VALIDATING = 'validating',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error'
}

export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: File;
  documentType: DocumentType;
}

export interface UploadProgress {
  percentage: number;
  message: string;
  status: UploadStatus;
}

export interface UploadResult {
  success: boolean;
  documentId?: string;
  jobId?: string;
  filename?: string;
  message?: string;
  error?: string;
}

export interface UploadMetadata {
  siteId?: string;
  tags?: string[];
  description?: string;
  customFields?: Record<string, any>;
}

export class DocumentUploadEntity {
  constructor(
    public readonly file: DocumentFile,
    public readonly metadata: UploadMetadata = {},
    public readonly progress: UploadProgress = {
      percentage: 0,
      message: '준비 중',
      status: UploadStatus.IDLE
    }
  ) {}

  // 파일 검증 비즈니스 로직
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 파일 크기 검증 (10MB 제한)
    const maxSize = 10 * 1024 * 1024;
    if (this.file.size > maxSize) {
      errors.push('파일 크기가 10MB를 초과합니다.');
    }

    // 파일 형식 검증
    const supportedTypes = ['.txt', '.md', '.pdf', '.doc', '.docx', '.html', '.htm'];
    const fileExt = this.getFileExtension();
    if (!supportedTypes.includes(fileExt)) {
      errors.push(`지원하지 않는 파일 형식입니다. 지원 형식: ${supportedTypes.join(', ')}`);
    }

    // 파일명 검증
    if (!this.file.name.trim()) {
      errors.push('파일명이 비어있습니다.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 파일 확장자 추출
  private getFileExtension(): string {
    return this.file.name.substring(this.file.name.lastIndexOf('.')).toLowerCase();
  }

  // 문서 타입 추론
  inferDocumentType(): DocumentType {
    const ext = this.getFileExtension();
    
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

  // 진행 상태 업데이트
  updateProgress(progress: Partial<UploadProgress>): DocumentUploadEntity {
    return new DocumentUploadEntity(
      this.file,
      this.metadata,
      { ...this.progress, ...progress }
    );
  }

  // 메타데이터 업데이트
  updateMetadata(metadata: Partial<UploadMetadata>): DocumentUploadEntity {
    return new DocumentUploadEntity(
      this.file,
      { ...this.metadata, ...metadata },
      this.progress
    );
  }

  // 업로드 가능 여부 확인
  canUpload(): boolean {
    const validation = this.validate();
    return validation.isValid && this.progress.status === UploadStatus.IDLE;
  }

  // 업로드 중인지 확인
  isUploading(): boolean {
    return [UploadStatus.VALIDATING, UploadStatus.UPLOADING, UploadStatus.PROCESSING].includes(this.progress.status);
  }

  // 업로드 완료 여부 확인
  isCompleted(): boolean {
    return [UploadStatus.SUCCESS, UploadStatus.ERROR].includes(this.progress.status);
  }
}

// 도메인 이벤트
export interface DocumentUploadEvent {
  type: 'upload_started' | 'upload_progress' | 'upload_completed' | 'upload_failed';
  documentId: string;
  data?: any;
}

// 도메인 서비스 인터페이스 (포트)
export interface DocumentUploadService {
  uploadDocument(entity: DocumentUploadEntity): Promise<UploadResult>;
  getUploadProgress(jobId: string): Promise<UploadProgress>;
  cancelUpload(jobId: string): Promise<void>;
}

// 이벤트 핸들러 인터페이스
export interface DocumentUploadEventHandler {
  handle(event: DocumentUploadEvent): void;
} 