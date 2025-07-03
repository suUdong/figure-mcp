import { DatabaseService } from '../services/database.service';
import { RedisService } from '../services/redis.service';
import { JiraService } from '../services/jira.service';
import { RagService } from '../services/rag.service';
import { OutputService } from '../services/output.service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface DesignFigureArgs {
  sitename: string;
  jiraTicketId: string;
  options?: {
    outputFormat?: 'code' | 'documentation' | 'both';
    deliveryMethod?: 'inline' | 'file' | 'repository';
  };
}

export class DesignFigureHandler {
  private jiraService: JiraService;
  private ragService: RagService;
  private outputService: OutputService;

  constructor(
    private databaseService: DatabaseService,
    private redisService: RedisService
  ) {
    this.jiraService = new JiraService();
    this.ragService = new RagService();
    this.outputService = new OutputService();
  }

  /**
   * 'use design figure' 명령어 처리
   */
  public async handleDesignFigure(args: DesignFigureArgs) {
    const jobId = uuidv4();
    
    try {
      logger.info('Starting design figure process', {
        jobId,
        sitename: args.sitename,
        jiraTicketId: args.jiraTicketId,
        options: args.options,
      });

      // 1. 프로젝트 조회/검증
      const project = await this.getProject(args.sitename);
      if (!project) {
        throw new Error(`프로젝트를 찾을 수 없습니다: ${args.sitename}`);
      }

      // 2. 작업 이력 생성
      const jobHistory = await this.databaseService.createJobHistory({
        projectId: project.id,
        jiraTicketId: args.jiraTicketId,
        command: `use design figure ${args.sitename} ${args.jiraTicketId}`,
        inputData: args,
      });

      // 3. 작업 상태를 Redis에 캐싱
      await this.redisService.cacheJobStatus(jobId, {
        status: 'processing',
        progress: 0,
        message: '작업을 시작했습니다...',
        startedAt: new Date().toISOString(),
      });

      // 4. 비동기로 작업 처리 (백그라운드)
      this.processDesignFigureAsync(jobId, jobHistory.id, project, args)
        .catch((error) => {
          logger.error('Async design figure process failed:', {
            jobId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      // 5. 즉시 작업 ID 반환
      return {
        content: [
          {
            type: 'text',
            text: `작업이 시작되었습니다.\n\n**작업 ID**: ${jobId}\n**사이트**: ${args.sitename}\n**Jira 티켓**: ${args.jiraTicketId}\n\n진행상태는 \`get_job_status\` 명령어로 확인할 수 있습니다.`,
          },
        ],
        isError: false,
      };

    } catch (error) {
      logger.error('Design figure handler error:', {
        jobId,
        args,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        content: [
          {
            type: 'text',
            text: `오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 백그라운드에서 실제 작업 처리
   */
  private async processDesignFigureAsync(
    jobId: string,
    jobHistoryId: string,
    project: any,
    args: DesignFigureArgs
  ) {
    try {
      // 진행상태 업데이트: Jira 연동 시작
      await this.updateProgress(jobId, 10, 'Jira에서 요구사항 추출 중...');

      // 1. Jira에서 요구사항 추출
      const requirements = await this.jiraService.getRequirements(
        project.jira_config,
        args.jiraTicketId
      );

      // 진행상태 업데이트: 개발 표준 검색 시작
      await this.updateProgress(jobId, 30, '개발 표준 문서 검색 중...');

      // 2. RAG를 통한 관련 개발 표준 검색
      const relevantStandards = await this.ragService.searchStandards(
        args.sitename,
        requirements
      );

      // 진행상태 업데이트: 산출물 생성 시작
      await this.updateProgress(jobId, 60, 'AI 기반 산출물 생성 중...');

      // 3. LLM을 통한 산출물 생성
      const outputs = await this.ragService.generateOutputs(
        requirements,
        relevantStandards,
        args.options
      );

      // 진행상태 업데이트: 결과 처리 중
      await this.updateProgress(jobId, 90, '결과 처리 및 저장 중...');

      // 4. 산출물 후처리 및 전달
      const processedOutputs = await this.outputService.processOutputs(
        outputs,
        args.options
      );

      // 5. 작업 완료 상태 업데이트
      await this.databaseService.updateJobStatus(
        jobHistoryId,
        'completed',
        processedOutputs
      );

      await this.redisService.cacheJobStatus(jobId, {
        status: 'completed',
        progress: 100,
        message: '작업이 완료되었습니다.',
        completedAt: new Date().toISOString(),
        outputs: processedOutputs,
      });

      logger.info('Design figure process completed successfully', {
        jobId,
        jobHistoryId,
        outputCount: processedOutputs.length,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 오류 상태 업데이트
      await this.databaseService.updateJobStatus(
        jobHistoryId,
        'failed',
        null,
        errorMessage
      );

      await this.redisService.cacheJobStatus(jobId, {
        status: 'failed',
        progress: 0,
        message: `작업 실패: ${errorMessage}`,
        failedAt: new Date().toISOString(),
        error: errorMessage,
      });

      logger.error('Design figure process failed:', {
        jobId,
        jobHistoryId,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * 프로젝트 조회 (캐시 우선)
   */
  private async getProject(siteName: string) {
    // Redis 캐시에서 먼저 조회
    let project = await this.redisService.getProject(siteName);
    
    if (!project) {
      // 캐시 미스 - DB에서 조회 후 캐싱
      project = await this.databaseService.getProject(siteName);
      if (project) {
        await this.redisService.cacheProject(siteName, project);
      }
    }

    return project;
  }

  /**
   * 작업 진행상태 업데이트
   */
  private async updateProgress(
    jobId: string,
    progress: number,
    message: string
  ) {
    await this.redisService.cacheJobStatus(jobId, {
      status: 'processing',
      progress,
      message,
      updatedAt: new Date().toISOString(),
    });

    logger.debug('Progress updated', {
      jobId,
      progress,
      message,
    });
  }
} 