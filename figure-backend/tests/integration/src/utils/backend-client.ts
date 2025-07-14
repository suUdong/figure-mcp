import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { RAGQueryRequest, RAGQueryResponse, Site } from './types.js';

export class BackendClient {
  private api: AxiosInstance;

  constructor(baseURL: string, timeout: number = 30000) {
    this.api = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async ragQuery(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const response: AxiosResponse<RAGQueryResponse> = await this.api.post(
      '/api/rag/query',
      request
    );
    return response.data;
  }

  async getSites(): Promise<Site[]> {
    const response: AxiosResponse<{ sites: Site[] }> = await this.api.get('/api/sites');
    return response.data.sites;
  }

  async createSite(name: string, description?: string): Promise<Site> {
    const response: AxiosResponse<Site> = await this.api.post('/api/sites', {
      name,
      description
    });
    return response.data;
  }

  async deleteSite(siteId: string): Promise<void> {
    await this.api.delete(`/api/sites/${siteId}`);
  }

  async uploadDocument(
    siteId: string, 
    content: string, 
    metadata?: { title?: string; source_url?: string; tags?: string[] }
  ): Promise<{ document_id: string; message: string }> {
    const response: AxiosResponse<{ document_id: string; message: string }> = 
      await this.api.post('/api/documents', {
        site_id: siteId,
        content,
        metadata: metadata || {}
      });
    return response.data;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.api.delete(`/api/documents/${documentId}`);
  }

  async searchDocuments(
    query: string, 
    siteIds: string[] = [], 
    maxResults: number = 10
  ): Promise<any[]> {
    const response: AxiosResponse<{ documents: any[] }> = await this.api.post(
      '/api/documents/search',
      {
        query,
        site_ids: siteIds,
        max_results: maxResults
      }
    );
    return response.data.documents;
  }

  async getMetrics(): Promise<any> {
    try {
      const response = await this.api.get('/metrics');
      return response.data;
    } catch (error) {
      // 메트릭스 엔드포인트가 없을 수 있으므로 에러를 무시
      return null;
    }
  }
} 