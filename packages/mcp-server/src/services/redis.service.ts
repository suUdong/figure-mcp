import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export class RedisService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    // 에러 핸들링
    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
    });
  }

  /**
   * Redis 연결
   */
  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Redis 연결 해제
   */
  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  /**
   * 키-값 저장
   */
  public async set(
    key: string,
    value: string,
    expireTimeSeconds?: number
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis is not connected');
    }

    try {
      if (expireTimeSeconds) {
        await this.client.setEx(key, expireTimeSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      
      logger.debug('Redis SET operation', {
        key,
        expireTimeSeconds,
      });
    } catch (error) {
      logger.error('Redis SET failed:', { key, error });
      throw error;
    }
  }

  /**
   * 값 조회
   */
  public async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Redis is not connected');
    }

    try {
      const result = await this.client.get(key);
      logger.debug('Redis GET operation', {
        key,
        found: result !== null,
      });
      return result;
    } catch (error) {
      logger.error('Redis GET failed:', { key, error });
      throw error;
    }
  }

  /**
   * JSON 객체 저장
   */
  public async setJSON(
    key: string,
    value: any,
    expireTimeSeconds?: number
  ): Promise<void> {
    const jsonString = JSON.stringify(value);
    await this.set(key, jsonString, expireTimeSeconds);
  }

  /**
   * JSON 객체 조회
   */
  public async getJSON<T>(key: string): Promise<T | null> {
    const jsonString = await this.get(key);
    if (jsonString === null) {
      return null;
    }

    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      logger.error('Failed to parse JSON from Redis:', { key, error });
      throw error;
    }
  }

  /**
   * 키 삭제
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis is not connected');
    }

    try {
      const result = await this.client.del(key);
      logger.debug('Redis DEL operation', {
        key,
        deleted: result > 0,
      });
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL failed:', { key, error });
      throw error;
    }
  }

  /**
   * 키 존재 여부 확인
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis is not connected');
    }

    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis EXISTS failed:', { key, error });
      throw error;
    }
  }

  /**
   * TTL 설정
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis is not connected');
    }

    try {
      const result = await this.client.expire(key, seconds);
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE failed:', { key, seconds, error });
      throw error;
    }
  }

  /**
   * 패턴으로 키 검색
   */
  public async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) {
      throw new Error('Redis is not connected');
    }

    try {
      const result = await this.client.keys(pattern);
      logger.debug('Redis KEYS operation', {
        pattern,
        count: result.length,
      });
      return result;
    } catch (error) {
      logger.error('Redis KEYS failed:', { pattern, error });
      throw error;
    }
  }

  /**
   * 캐시된 결과 조회 또는 생성
   */
  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    expireTimeSeconds?: number
  ): Promise<T> {
    // 캐시에서 조회
    const cached = await this.getJSON<T>(key);
    if (cached !== null) {
      logger.debug('Cache hit', { key });
      return cached;
    }

    // 캐시 미스 - 새로운 값 생성
    logger.debug('Cache miss', { key });
    const value = await factory();
    await this.setJSON(key, value, expireTimeSeconds);
    
    return value;
  }

  /**
   * 작업 상태 캐싱 (작업 ID 기반)
   */
  public async cacheJobStatus(
    jobId: string,
    status: any,
    expireTimeSeconds: number = 3600
  ): Promise<void> {
    const key = `job:${jobId}`;
    await this.setJSON(key, status, expireTimeSeconds);
  }

  /**
   * 작업 상태 조회
   */
  public async getJobStatus(jobId: string): Promise<any | null> {
    const key = `job:${jobId}`;
    return await this.getJSON(key);
  }

  /**
   * 프로젝트 정보 캐싱
   */
  public async cacheProject(
    siteName: string,
    project: any,
    expireTimeSeconds: number = 1800
  ): Promise<void> {
    const key = `project:${siteName}`;
    await this.setJSON(key, project, expireTimeSeconds);
  }

  /**
   * 프로젝트 정보 조회
   */
  public async getProject(siteName: string): Promise<any | null> {
    const key = `project:${siteName}`;
    return await this.getJSON(key);
  }
} 