export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface WorkspaceSettings {
  maxRows: number;
  queryTimeoutMs: number;
}

export interface DashboardKpis {
  totalRevenue: number;
  revenueGrowthPct: number;
  totalOrders: number;
  ordersGrowthPct: number;
  totalCustomers: number;
  newCustomers2026: number;
  activeBuyers: number;
  avgOrderValue: number;
  aovGrowthPct: number;
}

export interface RecentQuerySummary {
  id: number;
  question: string;
  executionStatus: string;
  executionTimeMs: number;
  rowCount: number;
  resultSummary: string | null;
  createdAt: string;
}

export interface RevenueSeriesPoint {
  month: string;
  revenue: number;
  orders: number;
  avg_order_value?: number;
  gross_profit?: number;
}

export interface ProductMetricRow {
  product_id: number;
  product_name: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
  units_sold: number;
  revenue: number;
  gross_profit: number;
  margin_pct: number;
}

export interface RegionMetricRow {
  region: string;
  customers: number;
  orders: number;
  revenue: number;
  avg_order_value: number;
}

export interface CategoryMetricRow {
  category: string;
  revenue: number;
  units_sold: number;
}

export type ChartType = 'kpi' | 'line' | 'area' | 'bar' | 'pie' | 'table';

export interface VisualizationConfig {
  chartType: ChartType;
  title: string;
  subtitle?: string;
  xKey: string;
  yKeys: string[];
  valueFormat: 'currency' | 'number' | 'percent';
  allowTableToggle: boolean;
  alternateCharts: ChartType[];
}

export interface PipelineTraceStep {
  node: string;
  label: string;
  status: 'running' | 'completed' | 'skipped' | 'failed';
  durationMs: number;
  detail?: string;
}

export interface SqlValidationPayload {
  isValid: boolean;
  sanitizedSql: string;
  errors: string[];
  warnings: string[];
  referencedTables: string[];
  appliedRowLimit: number;
  securityBlocked: boolean;
}

export interface AnalyticsQueryResponse {
  queryId: number;
  conversationId: string;
  question: string;
  executionStatus: 'succeeded' | 'failed' | 'blocked' | 'clarification' | 'pending';
  answer: string;
  generatedSql: string | null;
  sqlExplanation: string | null;
  validation: SqlValidationPayload | null;
  executionTimeMs: number;
  rowCount: number;
  truncated: boolean;
  retryCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
  visualization: VisualizationConfig | null;
  insights: string[];
  anomalies: string[];
  recommendations: string[];
  pipelineTrace: PipelineTraceStep[];
  feedback?: 'helpful' | 'needs_improvement' | null;
  createdAt: string;
}

export interface QueryHistoryItem {
  id: number;
  conversationId: string;
  question: string;
  generatedSql: string | null;
  sqlExplanation: string | null;
  validationStatus: string;
  executionStatus: string;
  executionTimeMs: number;
  rowCount: number;
  retryCount: number;
  resultSummary: string | null;
  feedback: string | null;
  createdAt: string;
}

export interface DatabaseStatusInfo {
  connected: boolean;
  dialect: string;
  engine: string;
  version: string;
  latencyMs: number;
  readOnlyEnforced: boolean;
  tableCount: number;
  totalRecords: number;
  llmProvider: string;
  llmModel: string;
  aiConfigured: boolean;
}

export interface TableColumnSchema {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  foreignKey?: {
    referencesTable: string;
    referencesColumn: string;
  };
}

export interface TableSchemaInfo {
  name: string;
  description: string;
  rowCount: number;
  columns: TableColumnSchema[];
}

export interface SchemaRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

export interface SavedReport {
  id: number;
  queryHistoryId?: number | null;
  title: string;
  description: string;
  question: string;
  generatedSql: string | null;
  summary: string;
  insights: string[];
  visualization: VisualizationConfig | null;
  columns: string[];
  rows: Record<string, unknown>[];
  createdAt: string;
}
