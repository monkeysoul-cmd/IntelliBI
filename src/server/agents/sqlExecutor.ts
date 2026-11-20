import type { PGlite } from '@electric-sql/pglite';
import {
  executeReadOnlyAnalyticsQuery,
  type SafeSqlExecutionResult,
} from '../db/pglite.ts';

/**
 * Node 5: SQL Execution Agent
 * Runs ONLY pre-validated SQL inside a read-only PostgreSQL transaction with statement_timeout.
 */
export async function executeValidatedSql(
  pg: PGlite,
  sanitizedSql: string,
  timeoutMs: number,
  maxRows: number
): Promise<SafeSqlExecutionResult> {
  return executeReadOnlyAnalyticsQuery(pg, sanitizedSql, timeoutMs, maxRows);
}
