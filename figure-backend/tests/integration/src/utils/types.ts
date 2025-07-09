export interface TestConfig {
  mcpServerUrl: string;
  backendUrl: string;
  openaiApiKey: string;
  figmaAccessToken?: string;
  timeout: number;
}

export interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  totalDuration: number;
  passCount: number;
  failCount: number;
  skipCount: number;
}

export interface MCPToolResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export interface RAGQueryRequest {
  query: string;
  site_ids: string[];
  max_results: number;
}

export interface RAGQueryResponse {
  response: string;
  sources: Array<{
    content: string;
    metadata: any;
    score: number;
  }>;
  query: string;
  processing_time: number;
}

export interface UploadDocumentRequest {
  site_id: string;
  content: string;
  metadata?: {
    title?: string;
    source_url?: string;
    tags?: string[];
  };
}

export interface Site {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
} 