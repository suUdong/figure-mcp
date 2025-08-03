/**
 * Backend API Client
 * figure-backend와 통신하는 HTTP 클라이언트
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger.js';
import type { 
  APIResponse, 
  Template, 
  TemplateGuideResponse, 
  Site, 
  DocumentUploadResponse,
  JobStatus 
} from '../types/api.js';

export class BackendApiClient {
  private client: AxiosInstance;
  private readonly baseUrl: string;

  constructor() {
    // Docker 환경에서는 서비스 이름으로 통신
    this.baseUrl = process.env.BACKEND_API_URL || 'http://figure-backend:8001/api';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10초 타임아웃
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // 요청/응답 인터셉터 설정
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 요청 인터셉터
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('API 요청', { 
          method: config.method?.toUpperCase(), 
          url: config.url,
          baseURL: config.baseURL 
        });
        return config;
      },
      (error) => {
        logger.error('API 요청 오류', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('API 응답 성공', { 
          status: response.status, 
          url: response.config.url 
        });
        return response;
      },
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleApiError(error: AxiosError) {
    if (error.response) {
      // 서버가 응답했지만 에러 상태 코드
      logger.error('API 응답 오류', {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        data: error.response.data
      });
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못함
      logger.error('API 요청 실패 - 응답 없음', {
        url: error.config?.url,
        message: error.message
      });
    } else {
      // 요청 설정 중 오류
      logger.error('API 요청 설정 오류', {
        message: error.message,
        url: error.config?.url
      });
    }
  }

  /**
   * 헬스체크 - 백엔드 연결 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get<APIResponse>('/health');
      return response.data.success === true;
    } catch (error) {
      logger.error('백엔드 헬스체크 실패', error);
      return false;
    }
  }

  /**
   * 템플릿 가이드 조회
   */
  async getTemplateGuide(
    templateType: string, 
    siteId?: string
  ): Promise<TemplateGuideResponse | null> {
    try {
      const params = siteId ? { site_id: siteId } : {};
      const response = await this.client.get<APIResponse<TemplateGuideResponse>>(
        `/templates/guide/${templateType}`, 
        { params }
      );
      
      if (response.data.success) {
        return response.data.data || null;
      } else {
        logger.warn('템플릿 가이드 조회 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('템플릿 가이드 조회 오류', { templateType, siteId, error });
      return null;
    }
  }

  /**
   * 사이트 목록 조회
   */
  async getSites(): Promise<Site[]> {
    try {
      const response = await this.client.get<APIResponse<Site[]>>('/sites');
      
      if (response.data.success) {
        return response.data.data || [];
      } else {
        logger.warn('사이트 목록 조회 실패', response.data.message);
        return [];
      }
    } catch (error) {
      logger.error('사이트 목록 조회 오류', error);
      return [];
    }
  }

  /**
   * 문서 업로드
   */
  async uploadDocument(
    sitename: string, 
    filepath: string
  ): Promise<DocumentUploadResponse | null> {
    try {
      // 실제로는 파일을 읽어서 업로드해야 하지만, 
      // 현재는 파일 경로만 전달하는 시뮬레이션
      const response = await this.client.post<APIResponse<DocumentUploadResponse>>(
        '/documents/upload',
        {
          title: filepath.split('/').pop() || 'Unknown',
          content: `Document from ${filepath}`,
          doc_type: 'text',
          site_id: sitename,
          metadata: {
            original_path: filepath,
            uploaded_via: 'mcp'
          }
        }
      );
      
      if (response.data.success) {
        return response.data.data || null;
      } else {
        logger.warn('문서 업로드 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('문서 업로드 오류', { sitename, filepath, error });
      return null;
    }
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      const response = await this.client.get<APIResponse<JobStatus>>(
        `/usage/jobs/${jobId}`
      );
      
      if (response.data.success) {
        return response.data.data || null;
      } else {
        logger.warn('작업 상태 조회 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('작업 상태 조회 오류', { jobId, error });
      return null;
    }
  }

  /**
   * RAG 검색
   */
  async ragSearch(
    query: string, 
    siteId?: string, 
    maxResults: number = 5
  ): Promise<any> {
    try {
      const response = await this.client.post<APIResponse>(
        '/rag/search',
        {
          query,
          site_id: siteId,
          max_results: maxResults
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        logger.warn('RAG 검색 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('RAG 검색 오류', { query, siteId, error });
      return null;
    }
  }

  /**
   * 메서드 의존성 분석
   */
  async analyzeMethodDependency(
    projectPath: string,
    language: string,
    targetClass?: string
  ): Promise<any> {
    try {
      const response = await this.client.post<APIResponse>(
        '/analysis/method-dependency',
        {
          project_path: projectPath,
          language: language,
          target_class: targetClass
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        logger.warn('메서드 의존성 분석 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('메서드 의존성 분석 오류', { projectPath, language, targetClass, error });
      return null;
    }
  }

  /**
   * 테이블 스키마 분석
   */
  async analyzeTableSchema(
    databaseType: string,
    connectionString?: string,
    schemaFile?: string,
    targetTables?: string[]
  ): Promise<any> {
    try {
      const response = await this.client.post<APIResponse>(
        '/analysis/table-schema',
        {
          database_type: databaseType,
          connection_string: connectionString,
          schema_file: schemaFile,
          target_tables: targetTables
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        logger.warn('테이블 스키마 분석 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('테이블 스키마 분석 오류', { databaseType, connectionString, schemaFile, targetTables, error });
      return null;
    }
  }

  /**
   * 순환 의존성 탐지
   */
  async detectCircularDependency(
    projectPath: string,
    language: string,
    maxDepth?: number
  ): Promise<any> {
    try {
      const response = await this.client.post<APIResponse>(
        '/analysis/circular-dependency',
        {
          project_path: projectPath,
          language: language,
          max_depth: maxDepth
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        logger.warn('순환 의존성 탐지 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('순환 의존성 탐지 오류', { projectPath, language, maxDepth, error });
      return null;
    }
  }

  /**
   * 영향도 점수 계산
   */
  async calculateImpactScore(
    projectPath: string,
    targetFiles: string[],
    changeType: string,
    language: string
  ): Promise<any> {
    try {
      const response = await this.client.post<APIResponse>(
        '/analysis/impact-score',
        {
          project_path: projectPath,
          target_files: targetFiles,
          change_type: changeType,
          language: language
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        logger.warn('영향도 점수 계산 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('영향도 점수 계산 오류', { projectPath, targetFiles, changeType, language, error });
      return null;
    }
  }

  /**
   * 종합 영향도 분석 리포트 생성
   */
  async generateComprehensiveImpactReport(
    projectPath: string,
    changeDescription: string,
    targetModules: string[],
    language: string,
    includeDatabase?: boolean,
    databaseType?: string
  ): Promise<any> {
    try {
      const response = await this.client.post<APIResponse>(
        '/analysis/comprehensive-impact-report',
        {
          project_path: projectPath,
          change_description: changeDescription,
          target_modules: targetModules,
          language: language,
          include_database: includeDatabase,
          database_type: databaseType
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        logger.warn('종합 영향도 분석 리포트 생성 실패', response.data.message);
        return null;
      }
    } catch (error) {
      logger.error('종합 영향도 분석 리포트 생성 오류', { 
        projectPath, changeDescription, targetModules, language, includeDatabase, databaseType, error 
      });
      return null;
    }
  }
}

// 싱글톤 인스턴스
export const backendClient = new BackendApiClient();