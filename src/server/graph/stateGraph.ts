import type { PGlite } from '@electric-sql/pglite';
import type {
  AgentNodeName,
  AgentWorkflowState,
  ConversationTurn,
  GraphStreamEvent,
} from '../agents/types.ts';
import { analyzeUserQuery } from '../agents/queryAnalyzer.ts';
import { gatherSchemaIntelligence } from '../agents/schemaIntelligence.ts';
import { correctSqlQuery, generateSqlQuery } from '../agents/sqlGenerator.ts';
import { validateAndSanitizeSql } from '../agents/sqlValidator.ts';
import { executeValidatedSql } from '../agents/sqlExecutor.ts';
import { computeStatisticalAnalysis } from '../agents/dataAnalysisAgent.ts';
import { selectVisualization } from '../agents/visualizationAgent.ts';
import { generateFinalResponse } from '../agents/responseGenerator.ts';

export const END_NODE = '__END__' as const;
export type GraphTarget = AgentNodeName | typeof END_NODE;

export interface WorkflowDependencies {
  pg: PGlite;
  analyzeQuery: typeof analyzeUserQuery;
  gatherSchema: typeof gatherSchemaIntelligence;
  generateSql: typeof generateSqlQuery;
  validateSql: typeof validateAndSanitizeSql;
  executeSql: typeof executeValidatedSql;
  correctSql: typeof correctSqlQuery;
  analyzeData: typeof computeStatisticalAnalysis;
  chooseVisualization: typeof selectVisualization;
  generateResponse: typeof generateFinalResponse;
}

const NODE_LABELS: Record<AgentNodeName, string> = {
  query_analyzer: 'Query Analyzer',
  schema_intelligence: 'Schema Intelligence',
  sql_generation: 'SQL Generation',
  sql_validation: 'SQL Validation',
  sql_execution: 'SQL Execution',
  sql_correction: 'SQL Correction',
  data_analysis: 'Data Analysis',
  visualization: 'Visualization',
  response_generation: 'Response Generation',
};

type NodeHandler = (state: AgentWorkflowState) => Promise<string | undefined>;
type EdgeRouter = (state: AgentWorkflowState) => GraphTarget;

/**
 * Typed StateGraph orchestrator modeled directly on LangGraph's StateGraph architecture:
 * - Separate specialized nodes with explicit typed shared state
 * - Conditional edge routing (clarification, security block, bounded retry loop)
 * - Streaming step events for real-time UI feedback
 * - Cycle guard ensuring deterministic termination
 */
export class StateGraph {
  private nodes = new Map<AgentNodeName, NodeHandler>();
  private edges = new Map<AgentNodeName, EdgeRouter>();
  private entryPoint: AgentNodeName = 'query_analyzer';

  addNode(name: AgentNodeName, handler: NodeHandler): this {
    this.nodes.set(name, handler);
    return this;
  }

  setEntryPoint(name: AgentNodeName): this {
    this.entryPoint = name;
    return this;
  }

  addEdge(from: AgentNodeName, to: GraphTarget): this {
    this.edges.set(from, () => to);
    return this;
  }

  addConditionalEdges(from: AgentNodeName, router: EdgeRouter): this {
    this.edges.set(from, router);
    return this;
  }

  async invoke(
    initialState: AgentWorkflowState,
    onEvent?: (event: GraphStreamEvent) => void
  ): Promise<AgentWorkflowState> {
    const state = initialState;
    let current: GraphTarget = this.entryPoint;
    let guardSteps = 0;
    const maxSteps = 20;

    while (current !== END_NODE && guardSteps < maxSteps) {
      guardSteps++;
      const handler = this.nodes.get(current);
      if (!handler) {
        throw new Error(`StateGraph node "${current}" is not registered.`);
      }

      const label = NODE_LABELS[current];
      const start = Date.now();
      onEvent?.({
        type: 'node_start',
        node: current,
        label,
        status: 'running',
      });

      try {
        const detail = await handler(state);
        const durationMs = Math.max(1, Date.now() - start);
        const stepStatus =
          current === 'sql_validation' && state.validation && !state.validation.isValid
            ? 'failed'
            : current === 'sql_execution' && state.lastError
              ? 'failed'
              : 'completed';

        state.trace.push({
          node: current,
          label,
          status: stepStatus,
          durationMs,
          detail,
        });

        onEvent?.({
          type: 'node_complete',
          node: current,
          label,
          status: stepStatus,
          durationMs,
          detail,
        });
      } catch (err: unknown) {
        const durationMs = Math.max(1, Date.now() - start);
        const msg = err instanceof Error ? err.message : String(err);
        state.trace.push({
          node: current,
          label,
          status: 'failed',
          durationMs,
          detail: msg,
        });
        onEvent?.({
          type: 'node_complete',
          node: current,
          label,
          status: 'failed',
          durationMs,
          detail: msg,
        });
        throw err;
      }

      const router = this.edges.get(current);
      current = router ? router(state) : END_NODE;
    }

    return state;
  }
}

export function buildAnalyticsWorkflow(deps: WorkflowDependencies): StateGraph {
  const graph = new StateGraph();

  // Node 1: User Query Analyzer
  graph.addNode('query_analyzer', async (state) => {
    const analysis = await deps.analyzeQuery(state.question, state.conversationHistory);
    state.analysis = analysis;

    if (analysis.intent === 'unsafe_request') {
      state.executionStatus = 'blocked';
      state.validation = {
        isValid: false,
        sanitizedSql: '',
        errors: [analysis.unsafeReason || 'Blocked by read-only analytics policy.'],
        warnings: [],
        referencedTables: [],
        appliedRowLimit: state.maxRows,
        securityBlocked: true,
      };
      state.finalAnswer =
        analysis.unsafeReason ||
        'This request cannot be executed because IntelliBI only supports read-only business analytics queries.';
      return 'Blocked unsafe request';
    }

    if (analysis.needsClarification || analysis.intent === 'clarification_needed') {
      state.executionStatus = 'clarification';
      state.finalAnswer =
        analysis.clarificationQuestion ||
        'Could you clarify which business metric, time range, or dimension you want to inspect?';
      return 'Clarification requested';
    }

    return `Intent: ${analysis.metrics.slice(0, 2).join(', ') || 'analytical query'}`;
  });

  // Node 2: Schema Intelligence Agent
  graph.addNode('schema_intelligence', async (state) => {
    const schemaContext = await deps.gatherSchema(
      deps.pg,
      state.question,
      state.analysis!
    );
    state.schemaContext = schemaContext;
    return `Tables: ${schemaContext.relevantTables.join(', ')}`;
  });

  // Node 3: SQL Generation Agent
  graph.addNode('sql_generation', async (state) => {
    const generated = await deps.generateSql(
      state.question,
      state.analysis!,
      state.schemaContext!,
      state.conversationHistory,
      state.maxRows
    );
    state.generatedSql = generated.sql;
    state.sqlExplanation = generated.explanation;
    state.lastError = null;
    return 'Generated PostgreSQL SELECT query';
  });

  // Node 4: SQL Validation Agent
  graph.addNode('sql_validation', async (state) => {
    const validation = deps.validateSql(state.generatedSql ?? '', state.maxRows);
    state.validation = validation;

    if (validation.isValid) {
      state.generatedSql = validation.sanitizedSql;
      state.lastError = null;
      return `Verified read-only AST (${validation.referencedTables.join(', ') || 'analytics'})`;
    }

    state.lastError = validation.errors.join(' ');
    if (validation.securityBlocked) {
      state.executionStatus = 'blocked';
      state.finalAnswer = `Query blocked by SQL Security Validator: ${validation.errors.join(' ')}`;
      return `Security blocked: ${validation.errors[0]}`;
    }

    return `Validation failed: ${validation.errors[0]}`;
  });

  // Node 5: SQL Execution Agent
  graph.addNode('sql_execution', async (state) => {
    try {
      const result = await deps.executeSql(
        deps.pg,
        state.validation!.sanitizedSql,
        state.timeoutMs,
        state.maxRows
      );
      state.executionResult = result;
      state.executionStatus = 'succeeded';
      state.lastError = null;
      return `${result.rows.length} rows in ${result.executionTimeMs}ms`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      state.lastError = msg;
      state.executionStatus = 'failed';
      return `Execution error: ${msg.slice(0, 120)}`;
    }
  });

  // Node 6: SQL Correction Agent (bounded to max 2 retries)
  graph.addNode('sql_correction', async (state) => {
    state.retryCount += 1;
    const corrected = await deps.correctSql(
      state.question,
      state.generatedSql ?? '',
      state.lastError ?? 'Unknown SQL error',
      state.schemaContext!,
      state.maxRows,
      state.retryCount
    );
    state.generatedSql = corrected.sql;
    state.sqlExplanation = corrected.explanation;
    return `Correction attempt ${state.retryCount} of ${state.maxRetries}`;
  });

  // Node 7: Data Analysis Agent
  graph.addNode('data_analysis', async (state) => {
    const rows = state.executionResult?.rows ?? [];
    const columns = state.executionResult?.columns ?? [];
    state.dataAnalysis = deps.analyzeData(columns, rows);
    return `Computed stats across ${state.dataAnalysis.columnStats.length} numeric metrics`;
  });

  // Node 8: Visualization Agent
  graph.addNode('visualization', async (state) => {
    const rows = state.executionResult?.rows ?? [];
    const columns = state.executionResult?.columns ?? [];
    state.visualization = deps.chooseVisualization(
      state.question,
      columns,
      rows,
      state.analysis
    );
    return `Selected ${state.visualization.chartType.toUpperCase()} view`;
  });

  // Node 9: Response Generation Agent
  graph.addNode('response_generation', async (state) => {
    if (state.executionStatus === 'failed') {
      state.finalAnswer = `I could not execute a valid query for this question after ${state.retryCount} automatic correction attempts. Last database error: ${state.lastError ?? 'Unknown error'}. Try rephrasing the question or specifying exact table fields from the Data Sources tab.`;
      state.recommendations = [
        'Inspect available tables and column names under Data Sources.',
        'Break complex multi-step questions into a narrower analytical query.',
      ];
      return 'Generated failure explanation';
    }

    const generated = await deps.generateResponse(
      state.question,
      state.generatedSql ?? '',
      state.executionResult?.rows ?? [],
      state.dataAnalysis!,
      state.visualization!
    );
    state.finalAnswer = generated.answer;
    if (state.dataAnalysis) {
      state.dataAnalysis.insights = generated.insights;
    }
    state.recommendations = generated.recommendations;
    return 'Synthesized grounded executive summary';
  });

  // Wire Graph Edges & Conditional Routing
  graph.setEntryPoint('query_analyzer');

  graph.addConditionalEdges('query_analyzer', (state) => {
    if (state.executionStatus === 'blocked' || state.executionStatus === 'clarification') {
      return END_NODE;
    }
    return 'schema_intelligence';
  });

  graph.addEdge('schema_intelligence', 'sql_generation');
  graph.addEdge('sql_generation', 'sql_validation');

  graph.addConditionalEdges('sql_validation', (state) => {
    if (state.validation?.isValid) {
      return 'sql_execution';
    }
    // Never retry explicit security violations
    if (state.validation?.securityBlocked) {
      return END_NODE;
    }
    // Recoverable syntax/unknown-column errors can retry up to maxRetries (2)
    if (state.retryCount < state.maxRetries) {
      return 'sql_correction';
    }
    state.executionStatus = 'failed';
    return 'response_generation';
  });

  graph.addConditionalEdges('sql_execution', (state) => {
    if (state.executionStatus === 'succeeded') {
      return 'data_analysis';
    }
    if (state.retryCount < state.maxRetries) {
      return 'sql_correction';
    }
    return 'response_generation';
  });

  // Correction loops back through Validation -> Execution
  graph.addEdge('sql_correction', 'sql_validation');
  graph.addEdge('data_analysis', 'visualization');
  graph.addEdge('visualization', 'response_generation');
  graph.addEdge('response_generation', END_NODE);

  return graph;
}

export async function runAnalyticsWorkflow(params: {
  pg: PGlite;
  question: string;
  conversationId: string;
  conversationHistory: ConversationTurn[];
  maxRows: number;
  timeoutMs: number;
  onEvent?: (event: GraphStreamEvent) => void;
}): Promise<AgentWorkflowState> {
  const graph = buildAnalyticsWorkflow({
    pg: params.pg,
    analyzeQuery: analyzeUserQuery,
    gatherSchema: gatherSchemaIntelligence,
    generateSql: generateSqlQuery,
    validateSql: validateAndSanitizeSql,
    executeSql: executeValidatedSql,
    correctSql: correctSqlQuery,
    analyzeData: computeStatisticalAnalysis,
    chooseVisualization: selectVisualization,
    generateResponse: generateFinalResponse,
  });

  const initialState: AgentWorkflowState = {
    question: params.question,
    conversationId: params.conversationId,
    conversationHistory: params.conversationHistory,
    maxRows: params.maxRows,
    timeoutMs: params.timeoutMs,
    retryCount: 0,
    maxRetries: 2,
    lastError: null,
    executionStatus: 'pending',
    trace: [],
  };

  return graph.invoke(initialState, params.onEvent);
}
