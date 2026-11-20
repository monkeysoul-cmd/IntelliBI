import { Router } from 'express';
import { getDb, executeReadOnlyAnalyticsQuery } from '../db/pglite.ts';
import { inspectAnalyticsSchema } from '../db/schemaInfo.ts';
import { requireAuth } from '../core/auth.ts';
import { config } from '../core/config.ts';
import { getActiveModelName, hasGeminiKeyConfigured } from '../core/gemini.ts';

const router = Router();

router.use(requireAuth);

router.get('/status', async (_req, res) => {
  try {
    const pg = await getDb();
    const start = Date.now();
    const verRes = await pg.query<{ version: string }>('SELECT version()');
    const latencyMs = Math.max(1, Date.now() - start);
    const schema = await inspectAnalyticsSchema(pg);
    const totalRows = schema.tables.reduce((acc, t) => acc + t.rowCount, 0);

    res.json({
      connected: true,
      dialect: 'PostgreSQL',
      engine: schema.engine,
      version: verRes.rows[0]?.version?.split(' ').slice(0, 2).join(' ') || 'PostgreSQL 16',
      latencyMs,
      readOnlyEnforced: true,
      tableCount: schema.tables.length,
      totalRecords: totalRows,
      llmProvider: config.llmProvider,
      llmModel: getActiveModelName(),
      aiConfigured: hasGeminiKeyConfigured(),
    });
  } catch (err) {
    console.error('Database status error:', err);
    res.status(500).json({ connected: false, error: 'Database connection check failed.' });
  }
});

router.get('/schema', async (_req, res) => {
  try {
    const pg = await getDb();
    const schema = await inspectAnalyticsSchema(pg);
    res.json(schema);
  } catch (err) {
    console.error('Schema inspect error:', err);
    res.status(500).json({ error: 'Failed to inspect PostgreSQL schema.' });
  }
});

router.get('/tables', async (_req, res) => {
  try {
    const pg = await getDb();
    const schema = await inspectAnalyticsSchema(pg);
    res.json({ tables: schema.tables, relationships: schema.relationships });
  } catch (err) {
    console.error('Tables list error:', err);
    res.status(500).json({ error: 'Failed to list database tables.' });
  }
});

router.get('/tables/:tableName/preview', async (req, res) => {
  try {
    const tableName = req.params.tableName.toLowerCase();
    if (!(config.allowedAnalyticsTables as readonly string[]).includes(tableName)) {
      res.status(403).json({ error: `Table "${tableName}" is not exposed for analytics preview.` });
      return;
    }

    const pg = await getDb();
    const preview = await executeReadOnlyAnalyticsQuery(
      pg,
      `SELECT * FROM ${tableName} LIMIT 12`,
      3000,
      12
    );
    res.json({
      table: tableName,
      columns: preview.columns,
      rows: preview.rows,
      executionTimeMs: preview.executionTimeMs,
    });
  } catch (err) {
    console.error('Table preview error:', err);
    res.status(500).json({ error: 'Failed to load table sample preview.' });
  }
});

export default router;
