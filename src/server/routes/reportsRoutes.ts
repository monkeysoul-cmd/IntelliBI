import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/pglite.ts';
import { requireAuth, type AuthRequest } from '../core/auth.ts';

const router = Router();

router.use(requireAuth);

const createReportSchema = z.object({
  title: z.string().trim().min(2, 'Report title is required').max(180),
  description: z.string().trim().max(500).optional().default(''),
  queryHistoryId: z.number().int().positive().nullable().optional(),
  question: z.string().trim().min(1),
  generatedSql: z.string().nullable().optional(),
  summary: z.string().optional().default(''),
  insights: z.array(z.string()).optional().default([]),
  visualization: z.unknown().optional(),
  columns: z.array(z.string()).optional().default([]),
  rows: z.array(z.record(z.string(), z.unknown())).optional().default([]),
});

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.post('/generate', async (req: AuthRequest, res) => {
  try {
    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid report payload.' });
      return;
    }

    const d = parsed.data;
    const pg = await getDb();

    let verifiedHistoryId: number | null = null;
    if (d.queryHistoryId) {
      const histCheck = await pg.query<{ id: number }>(
        'SELECT id FROM app_query_history WHERE id = $1 AND user_id = $2 LIMIT 1',
        [d.queryHistoryId, req.user!.id]
      );
      verifiedHistoryId = histCheck.rows[0]?.id ?? null;
    }

    const inserted = await pg.query<{ id: number; created_at: string }>(
      `INSERT INTO app_reports (
         user_id, query_history_id, title, description, question, generated_sql,
         summary, insights_payload, visualization_config, result_payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, created_at::text`,
      [
        req.user!.id,
        verifiedHistoryId,
        d.title,
        d.description,
        d.question,
        d.generatedSql ?? null,
        d.summary,
        JSON.stringify(d.insights),
        d.visualization ? JSON.stringify(d.visualization) : null,
        JSON.stringify({ columns: d.columns, rows: d.rows }),
      ]
    );

    res.status(201).json({
      id: inserted.rows[0].id,
      title: d.title,
      description: d.description,
      question: d.question,
      generatedSql: d.generatedSql ?? null,
      summary: d.summary,
      insights: d.insights,
      visualization: d.visualization ?? null,
      columns: d.columns,
      rows: d.rows,
      createdAt: inserted.rows[0].created_at,
    });
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).json({ error: 'Failed to save analytical report.' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const pg = await getDb();
    const result = await pg.query<{
      id: number;
      query_history_id: number | null;
      title: string;
      description: string | null;
      question: string;
      generated_sql: string | null;
      summary: string | null;
      insights_payload: string[] | null;
      visualization_config: unknown;
      result_payload: { columns?: string[]; rows?: Record<string, unknown>[] } | null;
      created_at: string;
    }>(
      `SELECT * FROM app_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id]
    );

    res.json({
      reports: result.rows.map((r) => ({
        id: r.id,
        queryHistoryId: r.query_history_id,
        title: r.title,
        description: r.description ?? '',
        question: r.question,
        generatedSql: r.generated_sql,
        summary: r.summary ?? '',
        insights: Array.isArray(r.insights_payload) ? r.insights_payload : [],
        visualization: r.visualization_config,
        columns: r.result_payload?.columns ?? [],
        rows: r.result_payload?.rows ?? [],
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('List reports error:', err);
    res.status(500).json({ error: 'Failed to load saved reports.' });
  }
});

router.get('/:reportId', async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.reportId);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      res.status(400).json({ error: 'Invalid report ID.' });
      return;
    }

    const pg = await getDb();
    const result = await pg.query<{
      id: number;
      title: string;
      description: string | null;
      question: string;
      generated_sql: string | null;
      summary: string | null;
      insights_payload: string[] | null;
      visualization_config: unknown;
      result_payload: { columns?: string[]; rows?: Record<string, unknown>[] } | null;
      created_at: string;
    }>(
      'SELECT * FROM app_reports WHERE id = $1 AND user_id = $2 LIMIT 1',
      [reportId, req.user!.id]
    );

    const r = result.rows[0];
    if (!r) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    res.json({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      question: r.question,
      generatedSql: r.generated_sql,
      summary: r.summary ?? '',
      insights: Array.isArray(r.insights_payload) ? r.insights_payload : [],
      visualization: r.visualization_config,
      columns: r.result_payload?.columns ?? [],
      rows: r.result_payload?.rows ?? [],
      createdAt: r.created_at,
    });
  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({ error: 'Failed to load report.' });
  }
});

router.delete('/:reportId', async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.reportId);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      res.status(400).json({ error: 'Invalid report ID.' });
      return;
    }

    const pg = await getDb();
    const deleted = await pg.query<{ id: number }>(
      'DELETE FROM app_reports WHERE id = $1 AND user_id = $2 RETURNING id',
      [reportId, req.user!.id]
    );

    if (deleted.rows.length === 0) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    res.json({ ok: true, id: reportId });
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).json({ error: 'Failed to delete report.' });
  }
});

router.get('/:reportId/download', async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.reportId);
    const format = req.query.format === 'md' ? 'md' : 'csv';
    if (!Number.isInteger(reportId) || reportId <= 0) {
      res.status(400).json({ error: 'Invalid report ID.' });
      return;
    }

    const pg = await getDb();
    const result = await pg.query<{
      title: string;
      question: string;
      generated_sql: string | null;
      summary: string | null;
      insights_payload: string[] | null;
      result_payload: { columns?: string[]; rows?: Record<string, unknown>[] } | null;
      created_at: string;
    }>(
      'SELECT title, question, generated_sql, summary, insights_payload, result_payload, created_at::text FROM app_reports WHERE id = $1 AND user_id = $2 LIMIT 1',
      [reportId, req.user!.id]
    );

    const r = result.rows[0];
    if (!r) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'intellibi-report';
    const columns = r.result_payload?.columns ?? [];
    const rows = r.result_payload?.rows ?? [];

    if (format === 'md') {
      const insights = Array.isArray(r.insights_payload) ? r.insights_payload : [];
      const md = [
        `# ${r.title}`,
        `Generated: ${r.created_at}`,
        '',
        `## Analytical Question`,
        r.question,
        '',
        `## Executive Summary`,
        r.summary || 'N/A',
        '',
        `## Key Insights`,
        ...insights.map((ins) => `- ${ins}`),
        '',
        `## Executed PostgreSQL Query`,
        '```sql',
        r.generated_sql || '-- No SQL recorded',
        '```',
      ].join('\n');

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${slug}.md"`);
      res.send(md);
      return;
    }

    const csvLines = [
      columns.map(escapeCsvCell).join(','),
      ...rows.map((row) => columns.map((col) => escapeCsvCell(row[col])).join(',')),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.csv"`);
    res.send(csvLines.join('\n'));
  } catch (err) {
    console.error('Download report error:', err);
    res.status(500).json({ error: 'Failed to export report.' });
  }
});

export default router;
