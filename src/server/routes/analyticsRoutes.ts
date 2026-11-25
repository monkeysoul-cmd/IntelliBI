import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../db/pglite.ts';
import { requireAuth, type AuthRequest } from '../core/auth.ts';
import { config } from '../core/config.ts';
import { runAnalyticsWorkflow } from '../graph/stateGraph.ts';
import type { ConversationTurn, GraphStreamEvent } from '../agents/types.ts';

const router = Router();

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for AI analytics queries. Please wait a moment and try again.' },
});

const queryRequestSchema = z.object({
  question: z.string().trim().min(1, 'Please enter an analytical question.').max(1000),
  conversationId: z.string().trim().min(1).max(80).optional(),
  conversationHistory: z
    .array(
      z.object({
        question: z.string().max(2000),
        generatedSql: z.string().max(8000).nullable().optional(),
        summary: z.string().max(4000).nullable().optional(),
      })
    )
    .max(10)
    .optional(),
});

const feedbackSchema = z.object({
  queryId: z.number().int().positive(),
  feedback: z.enum(['helpful', 'needs_improvement']),
});

router.use(requireAuth);

async function getLimitsForUser(userId: number) {
  const pg = await getDb();
  const res = await pg.query<{ max_rows: number; query_timeout_ms: number }>(
    'SELECT max_rows, query_timeout_ms FROM app_settings WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return {
    maxRows: res.rows[0]?.max_rows ?? config.defaultMaxQueryRows,
    timeoutMs: res.rows[0]?.query_timeout_ms ?? config.defaultQueryTimeoutMs,
  };
}

async function persistQueryHistory(
  userId: number,
  conversationId: string,
  state: Awaited<ReturnType<typeof runAnalyticsWorkflow>>
): Promise<number> {
  const pg = await getDb();
  const validationStatus = state.validation
    ? state.validation.isValid
      ? 'passed'
      : state.validation.securityBlocked
        ? 'blocked'
        : 'failed'
    : state.executionStatus === 'clarification'
      ? 'skipped'
      : 'failed';

  const inserted = await pg.query<{ id: number }>(
    `INSERT INTO app_query_history (
       user_id, conversation_id, question, generated_sql, sql_explanation,
       validation_status, execution_status, execution_time_ms, row_count, retry_count,
       result_summary, result_payload, visualization_config, insights_payload, pipeline_trace
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      userId,
      conversationId,
      state.question,
      state.generatedSql ?? null,
      state.sqlExplanation ?? null,
      validationStatus,
      state.executionStatus,
      state.executionResult?.executionTimeMs ?? 0,
      state.executionResult?.rows.length ?? 0,
      state.retryCount,
      state.finalAnswer ?? null,
      state.executionResult
        ? JSON.stringify({
          columns: state.executionResult.columns,
          rows: state.executionResult.rows,
          truncated: state.executionResult.truncated,
        })
        : null,
      state.visualization ? JSON.stringify(state.visualization) : null,
      JSON.stringify({
        insights: state.dataAnalysis?.insights ?? [],
        recommendations: state.recommendations ?? [],
        anomalies: state.dataAnalysis?.anomalies ?? [],
      }),
      JSON.stringify(state.trace),
    ]
  );

  return inserted.rows[0].id;
}

function formatWorkflowResponse(
  queryId: number,
  conversationId: string,
  state: Awaited<ReturnType<typeof runAnalyticsWorkflow>>
) {
  return {
    queryId,
    conversationId,
    question: state.question,
    executionStatus: state.executionStatus,
    answer: state.finalAnswer ?? '',
    generatedSql: state.generatedSql ?? null,
    sqlExplanation: state.sqlExplanation ?? null,
    validation: state.validation ?? null,
    executionTimeMs: state.executionResult?.executionTimeMs ?? 0,
    rowCount: state.executionResult?.rows.length ?? 0,
    truncated: state.executionResult?.truncated ?? false,
    retryCount: state.retryCount,
    columns: state.executionResult?.columns ?? [],
    rows: state.executionResult?.rows ?? [],
    visualization: state.visualization ?? null,
    insights: state.dataAnalysis?.insights ?? [],
    anomalies: state.dataAnalysis?.anomalies ?? [],
    recommendations: state.recommendations ?? [],
    pipelineTrace: state.trace,
    createdAt: new Date().toISOString(),
  };
}

router.post('/query', aiRateLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = queryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid query payload.' });
      return;
    }

    const pg = await getDb();
    const { maxRows, timeoutMs } = await getLimitsForUser(req.user!.id);
    const conversationId = parsed.data.conversationId || `conv-${Date.now()}`;
    const history: ConversationTurn[] = parsed.data.conversationHistory ?? [];

    const state = await runAnalyticsWorkflow({
      pg,
      question: parsed.data.question,
      conversationId,
      conversationHistory: history,
      maxRows,
      timeoutMs,
    });

    const queryId = await persistQueryHistory(req.user!.id, conversationId, state);
    res.json(formatWorkflowResponse(queryId, conversationId, state));
  } catch (err: unknown) {
    console.error('Analytics query error:', err);
    const message = err instanceof Error ? err.message : 'Failed to execute AI analytics workflow.';
    res.status(500).json({ error: message });
  }
});

router.post('/query/stream', aiRateLimiter, async (req: AuthRequest, res) => {
  const parsed = queryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid query payload.' });
    return;
  }

  let clientClosed = false;
  req.on('close', () => {
    clientClosed = true;
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: GraphStreamEvent) => {
    if (clientClosed || res.writableEnded || res.destroyed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const pg = await getDb();
    const { maxRows, timeoutMs } = await getLimitsForUser(req.user!.id);
    const conversationId = parsed.data.conversationId || `conv-${Date.now()}`;
    const history: ConversationTurn[] = parsed.data.conversationHistory ?? [];

    const state = await runAnalyticsWorkflow({
      pg,
      question: parsed.data.question,
      conversationId,
      conversationHistory: history,
      maxRows,
      timeoutMs,
      onEvent: sendEvent,
    });

    const queryId = await persistQueryHistory(req.user!.id, conversationId, state);
    const payload = formatWorkflowResponse(queryId, conversationId, state);
    sendEvent({ type: 'result', payload });
    if (!res.writableEnded) res.end();
  } catch (err: unknown) {
    console.error('Streaming analytics error:', err);
    const message = err instanceof Error ? err.message : 'Failed to execute AI analytics workflow.';
    sendEvent({ type: 'error', error: message });
    if (!res.writableEnded) res.end();
  }
});

router.get('/history', async (req: AuthRequest, res) => {
  try {
    const pg = await getDb();
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';

    const params: unknown[] = [req.user!.id];
    const conditions: string[] = ['user_id = $1'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(question ILIKE $${params.length} OR COALESCE(generated_sql, '') ILIKE $${params.length})`);
    }
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`execution_status = $${params.length}`);
    }

    const result = await pg.query<{
      id: number;
      conversation_id: string;
      question: string;
      generated_sql: string | null;
      sql_explanation: string | null;
      validation_status: string;
      execution_status: string;
      execution_time_ms: number;
      row_count: number;
      retry_count: number;
      result_summary: string | null;
      feedback: string | null;
      created_at: string;
    }>(
      `SELECT id, conversation_id, question, generated_sql, sql_explanation,
              validation_status, execution_status, execution_time_ms, row_count,
              retry_count, result_summary, feedback, created_at::text
       FROM app_query_history
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 100`,
      params
    );

    res.json({
      items: result.rows.map((r) => ({
        id: r.id,
        conversationId: r.conversation_id,
        question: r.question,
        generatedSql: r.generated_sql,
        sqlExplanation: r.sql_explanation,
        validationStatus: r.validation_status,
        executionStatus: r.execution_status,
        executionTimeMs: r.execution_time_ms,
        rowCount: r.row_count,
        retryCount: r.retry_count,
        resultSummary: r.result_summary,
        feedback: r.feedback,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('History list error:', err);
    res.status(500).json({ error: 'Failed to load query history.' });
  }
});

router.get('/history/:queryId', async (req: AuthRequest, res) => {
  try {
    const queryId = Number(req.params.queryId);
    if (!Number.isInteger(queryId) || queryId <= 0) {
      res.status(400).json({ error: 'Invalid query ID.' });
      return;
    }

    const pg = await getDb();
    const result = await pg.query<{
      id: number;
      conversation_id: string;
      question: string;
      generated_sql: string | null;
      sql_explanation: string | null;
      validation_status: string;
      execution_status: string;
      execution_time_ms: number;
      row_count: number;
      retry_count: number;
      result_summary: string | null;
      result_payload: { columns?: string[]; rows?: Record<string, unknown>[]; truncated?: boolean } | null;
      visualization_config: unknown;
      insights_payload: { insights?: string[]; recommendations?: string[]; anomalies?: string[] } | string[] | null;
      pipeline_trace: unknown;
      feedback: string | null;
      created_at: string;
    }>(
      `SELECT * FROM app_query_history WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [queryId, req.user!.id]
    );

    const r = result.rows[0];
    if (!r) {
      res.status(404).json({ error: 'Query record not found.' });
      return;
    }

    const insightsObj = Array.isArray(r.insights_payload)
      ? { insights: r.insights_payload, recommendations: [], anomalies: [] }
      : {
        insights: r.insights_payload?.insights ?? [],
        recommendations: r.insights_payload?.recommendations ?? [],
        anomalies: r.insights_payload?.anomalies ?? [],
      };

    res.json({
      queryId: r.id,
      conversationId: r.conversation_id,
      question: r.question,
      executionStatus: r.execution_status,
      answer: r.result_summary ?? '',
      generatedSql: r.generated_sql,
      sqlExplanation: r.sql_explanation,
      validation: {
        isValid: r.validation_status === 'passed',
        sanitizedSql: r.generated_sql ?? '',
        errors:
          r.validation_status === 'passed' || r.validation_status === 'skipped'
            ? []
            : ['Validation did not pass.'],
        warnings: [],
        referencedTables: [],
        appliedRowLimit: config.defaultMaxQueryRows,
        securityBlocked: r.validation_status === 'blocked',
      },
      executionTimeMs: r.execution_time_ms,
      rowCount: r.row_count,
      truncated: Boolean(r.result_payload?.truncated),
      retryCount: r.retry_count,
      columns: r.result_payload?.columns ?? [],
      rows: r.result_payload?.rows ?? [],
      visualization: r.visualization_config,
      insights: insightsObj.insights,
      anomalies: insightsObj.anomalies,
      recommendations: insightsObj.recommendations,
      pipelineTrace: Array.isArray(r.pipeline_trace) ? r.pipeline_trace : [],
      feedback: r.feedback,
      createdAt: r.created_at,
    });
  } catch (err) {
    console.error('History detail error:', err);
    res.status(500).json({ error: 'Failed to load query record.' });
  }
});

router.post('/feedback', async (req: AuthRequest, res) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid feedback payload.' });
      return;
    }

    const pg = await getDb();
    const updated = await pg.query<{ id: number }>(
      `UPDATE app_query_history
       SET feedback = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [parsed.data.feedback, parsed.data.queryId, req.user!.id]
    );

    if (updated.rows.length === 0) {
      res.status(404).json({ error: 'Query record not found.' });
      return;
    }

    res.json({ ok: true, queryId: parsed.data.queryId, feedback: parsed.data.feedback });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Failed to save feedback.' });
  }
});

export default router;
