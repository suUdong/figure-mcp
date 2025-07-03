import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export class DatabaseService {
  private pool: Pool;
  private isConnected = false;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // 에러 핸들링
    this.pool.on('error', (err) => {
      logger.error('Database pool error:', err);
    });
  }

  /**
   * 데이터베이스 연결
   */
  public async connect(): Promise<void> {
    try {
      // 연결 테스트
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * 데이터베이스 연결 해제
   */
  public async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  /**
   * 쿼리 실행
   */
  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database is not connected');
    }

    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Query executed', {
        text,
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
      
      return result;
    } catch (error) {
      logger.error('Query execution failed:', {
        text,
        params,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 트랜잭션 실행
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.isConnected) {
      throw new Error('Database is not connected');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 프로젝트 조회
   */
  public async getProject(siteName: string) {
    const result = await this.query(
      'SELECT * FROM projects WHERE site_name = $1',
      [siteName]
    );
    return result.rows[0];
  }

  /**
   * 프로젝트 생성
   */
  public async createProject(projectData: {
    name: string;
    description?: string;
    siteName: string;
    jiraConfig?: any;
  }) {
    const { name, description, siteName, jiraConfig } = projectData;
    
    const result = await this.query(
      `INSERT INTO projects (name, description, site_name, jira_config, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [name, description, siteName, JSON.stringify(jiraConfig)]
    );
    
    return result.rows[0];
  }

  /**
   * 문서 정보 저장
   */
  public async createDocument(documentData: {
    projectId: string;
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    version?: string;
    vectorIds?: string[];
  }) {
    const {
      projectId,
      fileName,
      filePath,
      fileType,
      fileSize,
      version,
      vectorIds,
    } = documentData;

    const result = await this.query(
      `INSERT INTO documents (project_id, file_name, file_path, file_type, file_size, version, vector_ids, upload_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        projectId,
        fileName,
        filePath,
        fileType,
        fileSize,
        version,
        vectorIds ? JSON.stringify(vectorIds) : null,
      ]
    );

    return result.rows[0];
  }

  /**
   * 작업 이력 생성
   */
  public async createJobHistory(jobData: {
    projectId: string;
    jiraTicketId: string;
    command: string;
    inputData?: any;
  }) {
    const { projectId, jiraTicketId, command, inputData } = jobData;

    const result = await this.query(
      `INSERT INTO job_history (project_id, jira_ticket_id, command, input_data, started_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [projectId, jiraTicketId, command, JSON.stringify(inputData)]
    );

    return result.rows[0];
  }

  /**
   * 작업 상태 업데이트
   */
  public async updateJobStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    outputData?: any,
    errorMessage?: string
  ) {
    const result = await this.query(
      `UPDATE job_history 
       SET status = $1, output_data = $2, error_message = $3, completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
       WHERE id = $4
       RETURNING *`,
      [status, JSON.stringify(outputData), errorMessage, jobId]
    );

    return result.rows[0];
  }

  /**
   * 작업 조회
   */
  public async getJobHistory(jobId: string) {
    const result = await this.query(
      'SELECT * FROM job_history WHERE id = $1',
      [jobId]
    );
    return result.rows[0];
  }

  /**
   * 프로젝트의 문서 목록 조회
   */
  public async getDocumentsByProject(projectId: string) {
    const result = await this.query(
      'SELECT * FROM documents WHERE project_id = $1 ORDER BY upload_date DESC',
      [projectId]
    );
    return result.rows;
  }
} 