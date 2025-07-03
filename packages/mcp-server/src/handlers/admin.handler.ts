import { DatabaseService } from '../services/database.service';
import { DocumentService } from '../services/document.service';
import { logger } from '../utils/logger';

export interface UploadDocumentArgs {
  sitename: string;
  filePath: string;
  documentType?: string;
}

export interface GetJobStatusArgs {
  jobId: string;
}

export class AdminHandler {
  private documentService: DocumentService;

  constructor(private databaseService: DatabaseService) {
    this.documentService = new DocumentService();
  }

  /**
   * 등록된 사이트 목록 조회
   */
  public async handleListSites() {
    try {
      logger.info('Listing registered sites');

      const result = await this.databaseService.query(
        'SELECT site_name, name, description, created_at FROM projects ORDER BY created_at DESC'
      );

      const sites = result.rows.map((row: any) => ({
        siteName: row.site_name,
        projectName: row.name,
        description: row.description,
        createdAt: row.created_at,
      }));

      if (sites.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '등록된 사이트가 없습니다.',
            },
          ],
          isError: false,
        };
      }

      const siteList = sites
        .map(
          (site) =>
            `• **${site.siteName}** (${site.projectName})\n  ${site.description || '설명 없음'}\n  생성일: ${new Date(site.createdAt).toLocaleDateString('ko-KR')}`
        )
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `**등록된 사이트 목록** (${sites.length}개)\n\n${siteList}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      logger.error('List sites error:', error);

      return {
        content: [
          {
            type: 'text',
            text: `사이트 목록 조회 중 오류가 발생했습니다: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 개발 표준 문서 업로드
   */
  public async handleUploadDocument(args: UploadDocumentArgs) {
    try {
      logger.info('Uploading document', {
        sitename: args.sitename,
        filePath: args.filePath,
        documentType: args.documentType,
      });

      // 1. 프로젝트 존재 확인
      const project = await this.databaseService.getProject(args.sitename);
      if (!project) {
        throw new Error(`프로젝트를 찾을 수 없습니다: ${args.sitename}`);
      }

      // 2. 파일 처리 및 벡터화
      const processResult = await this.documentService.processDocument({
        projectId: project.id,
        siteName: args.sitename,
        filePath: args.filePath,
        documentType: args.documentType || 'standard',
      });

      // 3. 문서 정보 DB 저장
      const document = await this.databaseService.createDocument({
        projectId: project.id,
        fileName: processResult.fileName,
        filePath: processResult.storedPath,
        fileType: processResult.fileType,
        fileSize: processResult.fileSize,
        version: processResult.version,
        vectorIds: processResult.vectorIds,
      });

      logger.info('Document uploaded successfully', {
        documentId: document.id,
        fileName: document.file_name,
        vectorCount: processResult.vectorIds?.length || 0,
      });

      return {
        content: [
          {
            type: 'text',
            text: `문서가 성공적으로 업로드되었습니다.\n\n**파일명**: ${processResult.fileName}\n**사이트**: ${args.sitename}\n**크기**: ${Math.round(processResult.fileSize / 1024)} KB\n**처리된 청크**: ${processResult.vectorIds?.length || 0}개\n**문서 ID**: ${document.id}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      logger.error('Upload document error:', {
        args,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        content: [
          {
            type: 'text',
            text: `문서 업로드 중 오류가 발생했습니다: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 작업 상태 확인
   */
  public async handleGetJobStatus(args: GetJobStatusArgs) {
    try {
      logger.info('Getting job status', { jobId: args.jobId });

      // Redis에서 실시간 상태 조회
      const cachedStatus = await this.getCachedJobStatus(args.jobId);
      
      if (cachedStatus) {
        const statusText = this.formatJobStatus(cachedStatus);
        
        return {
          content: [
            {
              type: 'text',
              text: statusText,
            },
          ],
          isError: false,
        };
      }

      // Redis에 없으면 DB에서 조회
      const jobHistory = await this.databaseService.getJobHistory(args.jobId);
      
      if (!jobHistory) {
        return {
          content: [
            {
              type: 'text',
              text: `작업을 찾을 수 없습니다: ${args.jobId}`,
            },
          ],
          isError: true,
        };
      }

      const statusText = this.formatJobHistoryStatus(jobHistory);

      return {
        content: [
          {
            type: 'text',
            text: statusText,
          },
        ],
        isError: false,
      };
    } catch (error) {
      logger.error('Get job status error:', {
        jobId: args.jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        content: [
          {
            type: 'text',
            text: `작업 상태 조회 중 오류가 발생했습니다: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Redis에서 작업 상태 조회 (실시간)
   */
  private async getCachedJobStatus(jobId: string) {
    try {
      // Redis에서 캐시된 상태 조회
      const redisService = new (await import('../services/redis.service')).RedisService();
      return await redisService.getJobStatus(jobId);
    } catch (error) {
      logger.warn('Failed to get cached job status:', error);
      return null;
    }
  }

  /**
   * 실시간 작업 상태 포맷팅
   */
  private formatJobStatus(status: any): string {
    const progressBar = this.createProgressBar(status.progress || 0);
    
    let text = `**작업 상태**: ${this.getStatusEmoji(status.status)} ${this.getStatusText(status.status)}\n`;
    text += `**진행률**: ${progressBar} ${status.progress || 0}%\n`;
    text += `**메시지**: ${status.message || '처리 중...'}\n`;
    
    if (status.startedAt) {
      text += `**시작 시간**: ${new Date(status.startedAt).toLocaleString('ko-KR')}\n`;
    }
    
    if (status.completedAt) {
      text += `**완료 시간**: ${new Date(status.completedAt).toLocaleString('ko-KR')}\n`;
    }
    
    if (status.failedAt) {
      text += `**실패 시간**: ${new Date(status.failedAt).toLocaleString('ko-KR')}\n`;
      text += `**오류**: ${status.error}\n`;
    }
    
    if (status.outputs && status.outputs.length > 0) {
      text += `\n**생성된 산출물**: ${status.outputs.length}개\n`;
      status.outputs.forEach((output: any, index: number) => {
        text += `${index + 1}. ${output.type}: ${output.title || output.fileName || 'Untitled'}\n`;
      });
    }

    return text;
  }

  /**
   * DB 작업 이력 상태 포맷팅
   */
  private formatJobHistoryStatus(jobHistory: any): string {
    let text = `**작업 상태**: ${this.getStatusEmoji(jobHistory.status)} ${this.getStatusText(jobHistory.status)}\n`;
    text += `**명령어**: ${jobHistory.command}\n`;
    text += `**Jira 티켓**: ${jobHistory.jira_ticket_id}\n`;
    text += `**시작 시간**: ${new Date(jobHistory.started_at).toLocaleString('ko-KR')}\n`;
    
    if (jobHistory.completed_at) {
      text += `**완료 시간**: ${new Date(jobHistory.completed_at).toLocaleString('ko-KR')}\n`;
    }
    
    if (jobHistory.error_message) {
      text += `**오류 메시지**: ${jobHistory.error_message}\n`;
    }
    
    if (jobHistory.output_data) {
      try {
        const outputData = JSON.parse(jobHistory.output_data);
        if (outputData && outputData.length > 0) {
          text += `\n**생성된 산출물**: ${outputData.length}개\n`;
          outputData.forEach((output: any, index: number) => {
            text += `${index + 1}. ${output.type}: ${output.title || output.fileName || 'Untitled'}\n`;
          });
        }
      } catch (error) {
        // JSON 파싱 실패 시 무시
      }
    }

    return text;
  }

  /**
   * 상태별 이모지
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  }

  /**
   * 상태별 텍스트
   */
  private getStatusText(status: string): string {
    switch (status) {
      case 'pending': return '대기 중';
      case 'processing': return '처리 중';
      case 'completed': return '완료';
      case 'failed': return '실패';
      default: return '알 수 없음';
    }
  }

  /**
   * 진행률 바 생성
   */
  private createProgressBar(progress: number): string {
    const barLength = 10;
    const filledLength = Math.round((progress / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
  }
} 