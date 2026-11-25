import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/server/db/pglite';
import { buildAnalyticsWorkflow } from '../src/server/graph/stateGraph';
import { gatherSchemaIntelligence } from '../src/server/agents/schemaIntelligence';
import { validateAndSanitizeSql } from '../src/server/agents/sqlValidator';
import { executeValidatedSql } from '../src/server/agents/sqlExecutor';
import { computeStatisticalAnalysis } from '../src/server/agents/dataAnalysisAgent';
import { selectVisualization } from '../src/server/agents/visualizationAgent';
import type { AgentWorkflowState } from '../src/server/agents/types';

test('StateGraph executes end-to-end analytical query against real embedded PostgreSQL', async () => {
  const pg = await getDb('memory://');

  const graph = buildAnalyticsWorkflow({
    pg,
    analyzeQuery: async () => ({
      intent: 'analytical_query',
      metrics: ['total_revenue'],
      dimensions: ['region'],
      filters: [],
      timeRange: null,
      aggregations: ['SUM'],
      needsClarification: false,
      clarificationQuestion: null,
      unsafeReason: null,
      preferredChartHint: 'bar',
    }),
    gatherSchema: gatherSchemaIntelligence,
    generateSql: async () => ({
      sql: `SELECT c.region, ROUND(SUM(o.total_amount), 2) AS total_revenue
            FROM orders o
            JOIN customers c ON o.customer_id = c.customer_id
            WHERE o.order_status <> 'Cancelled'
            GROUP BY c.region
            ORDER BY total_revenue DESC`,
      explanation: 'Calculates realized revenue grouped by customer region.',
    }),
    validateSql: validateAndSanitizeSql,
    executeSql: executeValidatedSql,
    correctSql: async () => {
      throw new Error('Should not invoke SQL correction on valid query');
    },
    analyzeData: computeStatisticalAnalysis,
    chooseVisualization: selectVisualization,
    generateResponse: async (_q, _sql, rows, analysis) => ({
      answer: `Computed revenue across ${rows.length} regions.`,
      insights: analysis.insights,
      recommendations: ['Focus enterprise expansion in top-performing territories.'],
    }),
  });

  const initial: AgentWorkflowState = {
    question: 'Compare revenue by region',
    conversationId: 'test-conv-1',
    conversationHistory: [],
    maxRows: 50,
    timeoutMs: 5000,
    retryCount: 0,
    maxRetries: 2,
    lastError: null,
    executionStatus: 'pending',
    trace: [],
  };

  const finalState = await graph.invoke(initial);
  assert.equal(finalState.executionStatus, 'succeeded');
  assert.equal(finalState.retryCount, 0);
  assert.ok((finalState.executionResult?.rows.length ?? 0) >= 4);
  assert.equal(finalState.visualization?.chartType, 'bar');
  assert.ok(finalState.trace.some((t) => t.node === 'sql_validation' && t.status === 'completed'));
  await pg.close();
});

test('StateGraph recovers via SQL Correction Agent when initial SQL fails execution', async () => {
  const pg = await getDb('memory://');
  let correctionCalls = 0;

  const graph = buildAnalyticsWorkflow({
    pg,
    analyzeQuery: async () => ({
      intent: 'analytical_query',
      metrics: ['orders'],
      dimensions: [],
      filters: [],
      timeRange: null,
      aggregations: ['COUNT'],
      needsClarification: false,
      clarificationQuestion: null,
      unsafeReason: null,
      preferredChartHint: 'kpi',
    }),
    gatherSchema: gatherSchemaIntelligence,
    generateSql: async () => ({
      // Intentionally wrong column name to trigger PostgreSQL error -> Node 6 correction
      sql: 'SELECT COUNT(nonexistent_col) AS total_orders FROM orders',
      explanation: 'Counts orders.',
    }),
    validateSql: validateAndSanitizeSql,
    executeSql: executeValidatedSql,
    correctSql: async () => {
      correctionCalls++;
      return {
        sql: 'SELECT COUNT(order_id) AS total_orders FROM orders',
        explanation: 'Fixed column name to order_id.',
      };
    },
    analyzeData: computeStatisticalAnalysis,
    chooseVisualization: selectVisualization,
    generateResponse: async () => ({
      answer: 'Total orders calculated after automatic SQL correction.',
      insights: ['Recovered cleanly on retry 1.'],
      recommendations: [],
    }),
  });

  const result = await graph.invoke({
    question: 'How many orders do we have?',
    conversationId: 'test-conv-2',
    conversationHistory: [],
    maxRows: 50,
    timeoutMs: 5000,
    retryCount: 0,
    maxRetries: 2,
    lastError: null,
    executionStatus: 'pending',
    trace: [],
  });

  assert.equal(result.executionStatus, 'succeeded');
  assert.equal(correctionCalls, 1);
  assert.equal(result.retryCount, 1);
  assert.ok(Number(result.executionResult?.rows[0]?.total_orders) > 100);
  await pg.close();
});

test('StateGraph enforces strict max 2 retries and halts gracefully on persistent errors', async () => {
  const pg = await getDb('memory://');
  let correctionCalls = 0;

  const graph = buildAnalyticsWorkflow({
    pg,
    analyzeQuery: async () => ({
      intent: 'analytical_query',
      metrics: ['x'],
      dimensions: [],
      filters: [],
      timeRange: null,
      aggregations: [],
      needsClarification: false,
      clarificationQuestion: null,
      unsafeReason: null,
      preferredChartHint: 'auto',
    }),
    gatherSchema: gatherSchemaIntelligence,
    generateSql: async () => ({
      sql: 'SELECT bad_col_1 FROM orders',
      explanation: 'Broken SQL',
    }),
    validateSql: validateAndSanitizeSql,
    executeSql: executeValidatedSql,
    correctSql: async () => {
      correctionCalls++;
      return { sql: `SELECT still_bad_${correctionCalls} FROM orders`, explanation: 'Still broken' };
    },
    analyzeData: computeStatisticalAnalysis,
    chooseVisualization: selectVisualization,
    generateResponse: async () => ({ answer: '', insights: [], recommendations: [] }),
  });

  const result = await graph.invoke({
    question: 'Broken query test',
    conversationId: 'test-conv-3',
    conversationHistory: [],
    maxRows: 50,
    timeoutMs: 5000,
    retryCount: 0,
    maxRetries: 2,
    lastError: null,
    executionStatus: 'pending',
    trace: [],
  });

  assert.equal(result.executionStatus, 'failed');
  assert.equal(correctionCalls, 2);
  assert.equal(result.retryCount, 2);
  assert.match(result.finalAnswer ?? '', /2 automatic correction attempts/);
  await pg.close();
});

test('StateGraph blocks unsafe SQL without ever invoking execution or retries', async () => {
  const pg = await getDb('memory://');
  let executed = false;

  const graph = buildAnalyticsWorkflow({
    pg,
    analyzeQuery: async () => ({
      intent: 'analytical_query',
      metrics: [],
      dimensions: [],
      filters: [],
      timeRange: null,
      aggregations: [],
      needsClarification: false,
      clarificationQuestion: null,
      unsafeReason: null,
      preferredChartHint: 'auto',
    }),
    gatherSchema: gatherSchemaIntelligence,
    generateSql: async () => ({
      sql: 'DROP TABLE orders',
      explanation: 'Malicious drop attempt',
    }),
    validateSql: validateAndSanitizeSql,
    executeSql: async () => {
      executed = true;
      throw new Error('Must never execute unvalidated SQL');
    },
    correctSql: async () => {
      throw new Error('Must not retry security violations');
    },
    analyzeData: computeStatisticalAnalysis,
    chooseVisualization: selectVisualization,
    generateResponse: async () => ({ answer: '', insights: [], recommendations: [] }),
  });

  const result = await graph.invoke({
    question: 'Test SQL security',
    conversationId: 'test-conv-4',
    conversationHistory: [],
    maxRows: 50,
    timeoutMs: 5000,
    retryCount: 0,
    maxRetries: 2,
    lastError: null,
    executionStatus: 'pending',
    trace: [],
  });

  assert.equal(result.executionStatus, 'blocked');
  assert.equal(executed, false);
  await pg.close();
});

test('executeValidatedSql serializes READ ONLY transactions safely alongside concurrent writes', async () => {
  const pg = await getDb('memory://');

  const demoUser = await pg.query<{ id: number }>('SELECT id FROM app_users LIMIT 1');
  const userId = demoUser.rows[0].id;

  await Promise.all([
    executeValidatedSql(
      pg,
      'SELECT c.region, COUNT(*) AS cnt FROM orders o JOIN customers c ON o.customer_id = c.customer_id GROUP BY c.region LIMIT 10',
      5000,
      50
    ),
    pg.query(
      `INSERT INTO app_settings (user_id, max_rows, query_timeout_ms)
       VALUES ($1, 200, 5000)
       ON CONFLICT (user_id) DO UPDATE SET max_rows = EXCLUDED.max_rows`,
      [userId]
    ),
    executeValidatedSql(pg, 'SELECT COUNT(*) AS orders_count FROM orders LIMIT 1', 5000, 50),
  ]);

  const check = await pg.query<{ max_rows: number }>(
    'SELECT max_rows FROM app_settings WHERE user_id = $1',
    [userId]
  );
  assert.equal(check.rows[0].max_rows, 200);
  await pg.close();
});
