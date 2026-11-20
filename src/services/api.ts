import axios from 'axios';
import type {
  AnalyticsQueryResponse,
  CategoryMetricRow,
  DashboardKpis,
  DatabaseStatusInfo,
  PipelineTraceStep,
  ProductMetricRow,
  QueryHistoryItem,
  RecentQuerySummary,
  RegionMetricRow,
  RevenueSeriesPoint,
  SavedReport,
  SchemaRelationship,
  TableSchemaInfo,
  UserProfile,
  WorkspaceSettings,
} from '../types/api';

let authTokenMemory: string | null =
  typeof window !== 'undefined' ? window.sessionStorage.getItem('intellibi_jwt') : null;

export function setAuthToken(token: string | null) {
  authTokenMemory = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.sessionStorage.setItem('intellibi_jwt', token);
    } else {
      window.sessionStorage.removeItem('intellibi_jwt');
    }
  }
}

export function getAuthToken(): string | null {
  return authTokenMemory;
}

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((req) => {
  if (authTokenMemory) {
    req.headers.Authorization = `Bearer ${authTokenMemory}`;
  }
  return req;
});

export interface AuthResponse {
  token: string;
  user: UserProfile;
  settings: WorkspaceSettings;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', { name, email, password });
    return data;
  },
  async demoSession(): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/demo');
    return data;
  },
  async me(): Promise<{ user: UserProfile; settings: WorkspaceSettings }> {
    const { data } = await apiClient.get<{ user: UserProfile; settings: WorkspaceSettings }>('/auth/me');
    return data;
  },
  async updateSettings(settings: WorkspaceSettings): Promise<{ settings: WorkspaceSettings }> {
    const { data } = await apiClient.patch<{ settings: WorkspaceSettings }>('/auth/settings', settings);
    return data;
  },
};

export const dashboardApi = {
  async getOverview(): Promise<{ kpis: DashboardKpis; recentQueries: RecentQuerySummary[] }> {
    const { data } = await apiClient.get('/dashboard/overview');
    return data;
  },
  async getRevenue(params?: {
    year?: string;
    region?: string;
    category?: string;
  }): Promise<{ series: RevenueSeriesPoint[] }> {
    const { data } = await apiClient.get('/dashboard/revenue', { params });
    return data;
  },
  async getProducts(params?: {
    year?: string;
    region?: string;
    category?: string;
    limit?: number;
  }): Promise<{ products: ProductMetricRow[]; categories: string[] }> {
    const { data } = await apiClient.get('/dashboard/products', { params });
    return data;
  },
  async getRegions(params?: {
    year?: string;
    category?: string;
  }): Promise<{ regions: RegionMetricRow[]; categories: CategoryMetricRow[] }> {
    const { data } = await apiClient.get('/dashboard/regions', { params });
    return data;
  },
};

export const databaseApi = {
  async getStatus(): Promise<DatabaseStatusInfo> {
    const { data } = await apiClient.get('/database/status');
    return data;
  },
  async getSchema(): Promise<{
    dialect: string;
    engine: string;
    tables: TableSchemaInfo[];
    relationships: SchemaRelationship[];
  }> {
    const { data } = await apiClient.get('/database/schema');
    return data;
  },
  async getTablePreview(tableName: string): Promise<{
    table: string;
    columns: string[];
    rows: Record<string, unknown>[];
    executionTimeMs: number;
  }> {
    const { data } = await apiClient.get(`/database/tables/${encodeURIComponent(tableName)}/preview`);
    return data;
  },
};

export interface StreamHandlers {
  onNodeEvent?: (step: PipelineTraceStep) => void;
  onResult: (result: AnalyticsQueryResponse) => void;
  onError: (message: string) => void;
}

export const analyticsApi = {
  async queryStream(
    payload: {
      question: string;
      conversationId: string;
      conversationHistory: Array<{
        question: string;
        generatedSql?: string | null;
        summary?: string | null;
      }>;
    },
    handlers: StreamHandlers
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authTokenMemory) {
      headers.Authorization = `Bearer ${authTokenMemory}`;
    }

    const res = await fetch('/api/analytics/query/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson?.error) msg = errJson.error;
      } catch {
        // ignore JSON parse error
      }
      handlers.onError(msg);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      handlers.onError('Streaming response body unavailable.');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let receivedTerminal = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        const line = chunk
          .split('\n')
          .find((l) => l.startsWith('data: '));
        if (!line) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'node_start' || event.type === 'node_complete') {
            handlers.onNodeEvent?.({
              node: event.node,
              label: event.label,
              status: event.status,
              durationMs: event.durationMs ?? 0,
              detail: event.detail,
            });
          } else if (event.type === 'result') {
            receivedTerminal = true;
            handlers.onResult(event.payload as AnalyticsQueryResponse);
          } else if (event.type === 'error') {
            receivedTerminal = true;
            handlers.onError(event.error || 'Workflow execution failed.');
          }
        } catch {
          // Ignore malformed chunk
        }
      }
    }

    if (!receivedTerminal) {
      handlers.onError('The analytics stream closed before completing. Please try again.');
    }
  },

  async getHistory(params?: {
    search?: string;
    status?: string;
  }): Promise<{ items: QueryHistoryItem[] }> {
    const { data } = await apiClient.get('/analytics/history', { params });
    return data;
  },

  async getHistoryItem(queryId: number): Promise<AnalyticsQueryResponse> {
    const { data } = await apiClient.get(`/analytics/history/${queryId}`);
    return data;
  },

  async submitFeedback(queryId: number, feedback: 'helpful' | 'needs_improvement'): Promise<void> {
    await apiClient.post('/analytics/feedback', { queryId, feedback });
  },
};

export const reportsApi = {
  async list(): Promise<{ reports: SavedReport[] }> {
    const { data } = await apiClient.get('/reports');
    return data;
  },
  async generate(payload: {
    title: string;
    description: string;
    queryHistoryId?: number | null;
    question: string;
    generatedSql: string | null;
    summary: string;
    insights: string[];
    visualization: unknown;
    columns: string[];
    rows: Record<string, unknown>[];
  }): Promise<SavedReport> {
    const { data } = await apiClient.post('/reports/generate', payload);
    return data;
  },
  async remove(reportId: number): Promise<void> {
    await apiClient.delete(`/reports/${reportId}`);
  },
  async download(reportId: number, format: 'csv' | 'md', filename: string): Promise<void> {
    const response = await apiClient.get(`/reports/${reportId}/download`, {
      params: { format },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
