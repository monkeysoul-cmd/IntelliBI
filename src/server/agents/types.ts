import type { DatabaseSchemaSnapshot } from '../db/schemaInfo.ts';

export type AgentNodeName =
  | 'query_analyzer'
  | 'schema_intelligence'
  | 'sql_generation'
  | 'sql_validation'
  | 'sql_execution'
  | 'sql_correction'
  | 'data_analysis'
  | 'visualization'
  | 'response_generation';

export interface NodeTraceStep {
  node: AgentNodeName;
  label: string;
  status: 'running' | 'completed' | 'skipped' | 'failed';
  durationMs: number;
  detail?: string;
}

export interface ConversationTurn {
  question: string;
  generatedSql?: string | null;
  summary?: string | null;
}

export interface QueryAnalysisResult {
  intent: 'analytical_query' | 'clarification_needed' | 'unsafe_request';
  metrics: string[];
  dimensions: string[];
  filters: string[];
  timeRange: string | null;
  aggregations: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  unsafeReason: string | null;
  preferredChartHint: 'auto' | 'line' | 'area' | 'bar' | 'pie' | 'table' | 'kpi';
}

export interface SchemaContextResult {
  relevantTables: string[];
  formattedSchema: string;
  businessMetricsNotes: string[];
  fullSchema: DatabaseSchemaSnapshot;
}

export interface SqlValidationResult {
  isValid: boolean;
  sanitizedSql: string;
  errors: string[];
  warnings: string[];
  referencedTables: string[];
  appliedRowLimit: number;
  securityBlocked: boolean;
}

export interface ComputedColumnStats {
  column: string;
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  topLabel?: string;
  topValue?: number;
  bottomLabel?: string;
  bottomValue?: number;
  trendDeltaPct?: number | null;
}

export interface DataAnalysisResult {
  rowCount: number;
  columnStats: ComputedColumnStats[];
  insights: string[];
  anomalies: string[];
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

export interface AgentWorkflowState {
  // Inputs
  question: string;
  conversationId: string;
  conversationHistory: ConversationTurn[];
  maxRows: number;
  timeoutMs: number;

  // Node 1
  analysis?: QueryAnalysisResult;

  // Node 2
  schemaContext?: SchemaContextResult;

  // Node 3 & 6
  generatedSql?: string;
  sqlExplanation?: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string | null;

  // Node 4
  validation?: SqlValidationResult;

  // Node 5
  executionResult?: {
    columns: string[];
    rows: Record<string, unknown>[];
    executionTimeMs: number;
    truncated: boolean;
  };
  executionStatus: 'pending' | 'succeeded' | 'failed' | 'blocked' | 'clarification';

  // Node 7
  dataAnalysis?: DataAnalysisResult;

  // Node 8
  visualization?: VisualizationConfig;

  // Node 9
  finalAnswer?: string;
  recommendations?: string[];

  // Telemetry / Trace
  trace: NodeTraceStep[];
}

export interface GraphStreamEvent {
  type: 'node_start' | 'node_complete' | 'token' | 'result' | 'error';
  node?: AgentNodeName;
  label?: string;
  status?: NodeTraceStep['status'];
  durationMs?: number;
  detail?: string;
  token?: string;
  payload?: unknown;
  error?: string;
}
