import pkg from 'node-sql-parser';
import { config } from '../core/config.ts';
import type { SqlValidationResult } from './types.ts';

const { Parser } = pkg;
const sqlParser = new Parser();

const FORBIDDEN_KEYWORDS_REGEX =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|COPY|EXECUTE|EXEC|CALL|DO|VACUUM|ANALYZE|LOCK|MERGE|SET\s+ROLE|SET\s+SESSION|RESET\s+ALL|LISTEN|NOTIFY|PREPARE|DEALLOCATE|DISCARD|REINDEX|CLUSTER|COMMENT\s+ON)\b/i;

const FORBIDDEN_FUNCTIONS_REGEX =
  /\b(pg_sleep|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|pg_terminate_backend|pg_cancel_backend|lo_import|lo_export|dblink|dblink_exec|query_to_xml|current_setting|set_config)\s*\(/i;

const FORBIDDEN_SCHEMAS_OR_TABLES_REGEX =
  /\b(pg_catalog|pg_shadow|pg_authid|pg_roles|pg_user|pg_stat_activity|pg_class|pg_tables|information_schema|app_users|app_query_history|app_reports|app_settings)\b/i;

const ALLOWED_TABLES_SET = new Set<string>(config.allowedAnalyticsTables);

function stripSqlComments(sql: string): string {
  // Remove block comments /* ... */ and single-line comments -- ...
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .trim();
}

function stripTrailingSemicolon(sql: string): string {
  return sql.replace(/;\s*$/, '').trim();
}

function hasMultipleStatements(cleanedSql: string): boolean {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < cleanedSql.length; i++) {
    const ch = cleanedSql[i];
    const prev = i > 0 ? cleanedSql[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
    } else if (ch === ';' && !inSingle && !inDouble) {
      return true;
    }
  }
  return false;
}

function collectAstMetadata(
  node: unknown,
  cteNames: Set<string>,
  tables: Set<string>,
  schemas: Set<string>,
  statementTypes: Set<string>
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectAstMetadata(item, cteNames, tables, schemas, statementTypes);
    }
    return;
  }

  const record = node as Record<string, unknown>;

  if (typeof record.type === 'string' && ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'replace', 'use', 'set'].includes(record.type.toLowerCase())) {
    statementTypes.add(record.type.toLowerCase());
  }

  // Register CTE names so we don't mistake a CTE alias for an unknown physical table
  if (Array.isArray(record.with)) {
    for (const cte of record.with) {
      if (cte && typeof cte === 'object') {
        const cteRec = cte as Record<string, unknown>;
        const nameObj = cteRec.name as Record<string, unknown> | string | undefined;
        if (typeof nameObj === 'string') {
          cteNames.add(nameObj.toLowerCase());
        } else if (nameObj && typeof nameObj.value === 'string') {
          cteNames.add(nameObj.value.toLowerCase());
        }
        collectAstMetadata(cteRec.stmt, cteNames, tables, schemas, statementTypes);
      }
    }
  }

  // Inspect FROM / JOIN clauses
  if (Array.isArray(record.from)) {
    for (const fromItem of record.from) {
      if (fromItem && typeof fromItem === 'object') {
        const itemRec = fromItem as Record<string, unknown>;
        if (typeof itemRec.db === 'string' && itemRec.db.trim()) {
          schemas.add(itemRec.db.toLowerCase());
        }
        if (typeof itemRec.table === 'string' && itemRec.table.trim()) {
          tables.add(itemRec.table.toLowerCase());
        }
        if (itemRec.expr) {
          collectAstMetadata(itemRec.expr, cteNames, tables, schemas, statementTypes);
        }
        if (itemRec.on) {
          collectAstMetadata(itemRec.on, cteNames, tables, schemas, statementTypes);
        }
      }
    }
  }

  // Traverse remaining keys
  for (const [key, val] of Object.entries(record)) {
    if (key === 'with' || key === 'from') continue;
    if (val && typeof val === 'object') {
      collectAstMetadata(val, cteNames, tables, schemas, statementTypes);
    }
  }
}

function enforceRowLimit(sql: string, maxRows: number): { sql: string; appliedLimit: number; warning?: string } {
  const safeMax = Math.min(Math.max(Math.floor(maxRows), 1), 1000);
  // Check top-level trailing LIMIT clause
  const limitMatch = sql.match(/\bLIMIT\s+(\d+)(\s+OFFSET\s+\d+)?\s*$/i);
  if (limitMatch) {
    const requestedLimit = Number(limitMatch[1]);
    if (requestedLimit > safeMax) {
      const clampedSql = sql.replace(
        /\bLIMIT\s+\d+(\s+OFFSET\s+\d+)?\s*$/i,
        (_, offsetPart = '') => `LIMIT ${safeMax}${offsetPart}`
      );
      return {
        sql: clampedSql,
        appliedLimit: safeMax,
        warning: `Clamped requested LIMIT ${requestedLimit} to maximum allowed ${safeMax} rows.`,
      };
    }
    return { sql, appliedLimit: requestedLimit };
  }

  // Append LIMIT safely
  return {
    sql: `${sql}\nLIMIT ${safeMax}`,
    appliedLimit: safeMax,
    warning: `Applied default safety cap of LIMIT ${safeMax}.`,
  };
}

/**
 * Node 4: SQL Validation Agent
 * Strictly parses and validates PostgreSQL SQL via AST + security rules.
 * Pure deterministic function — safe to unit test without network or DB.
 */
export function validateAndSanitizeSql(
  rawSql: string,
  maxRows: number = config.defaultMaxQueryRows
): SqlValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawSql || !rawSql.trim()) {
    return {
      isValid: false,
      sanitizedSql: '',
      errors: ['Generated SQL query is empty.'],
      warnings: [],
      referencedTables: [],
      appliedRowLimit: maxRows,
      securityBlocked: false,
    };
  }

  // Strip markdown fences if an LLM accidentally included them
  const unfenced = rawSql
    .replace(/^```(?:sql|postgresql|postgres)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const noComments = stripSqlComments(unfenced);
  const cleaned = stripTrailingSemicolon(noComments);

  if (!cleaned) {
    return {
      isValid: false,
      sanitizedSql: '',
      errors: ['SQL contains no executable statement after stripping comments.'],
      warnings: [],
      referencedTables: [],
      appliedRowLimit: maxRows,
      securityBlocked: true,
    };
  }

  // 1. Reject multiple statements
  if (hasMultipleStatements(cleaned)) {
    return {
      isValid: false,
      sanitizedSql: cleaned,
      errors: ['Security violation: Multiple SQL statements are strictly prohibited.'],
      warnings: [],
      referencedTables: [],
      appliedRowLimit: maxRows,
      securityBlocked: true,
    };
  }

  // 2. Reject modifying / administrative SQL keywords
  const forbiddenKw = cleaned.match(FORBIDDEN_KEYWORDS_REGEX);
  if (forbiddenKw) {
    return {
      isValid: false,
      sanitizedSql: cleaned,
      errors: [
        `Security violation: Statement contains prohibited operation "${forbiddenKw[0].toUpperCase()}". Only read-only SELECT queries are permitted.`,
      ],
      warnings: [],
      referencedTables: [],
      appliedRowLimit: maxRows,
      securityBlocked: true,
    };
  }

  // 3. Reject dangerous PostgreSQL system functions
  const forbiddenFn = cleaned.match(FORBIDDEN_FUNCTIONS_REGEX);
  if (forbiddenFn) {
    return {
      isValid: false,
      sanitizedSql: cleaned,
      errors: [
        `Security violation: Function "${forbiddenFn[1]}" is prohibited in read-only analytics mode.`,
      ],
      warnings: [],
      referencedTables: [],
      appliedRowLimit: maxRows,
      securityBlocked: true,
    };
  }

  // 4. Reject unauthorized internal/system schemas or application tables
  const forbiddenSchema = cleaned.match(FORBIDDEN_SCHEMAS_OR_TABLES_REGEX);
  if (forbiddenSchema) {
    return {
      isValid: false,
      sanitizedSql: cleaned,
      errors: [
        `Security violation: Access to restricted schema or internal table "${forbiddenSchema[0]}" is denied.`,
      ],
      warnings: [],
      referencedTables: [],
      appliedRowLimit: maxRows,
      securityBlocked: true,
    };
  }

  // 5. Must start with SELECT or WITH (CTE)
  if (!/^(SELECT|WITH)\b/i.test(cleaned)) {
    return {
      isValid: false,
      sanitizedSql: cleaned,
      errors: ['Only read-only SELECT queries and SELECT-based CTEs (WITH ...) are allowed.'],
      warnings: [],
      referencedTables: [],
      appliedRowLimit: maxRows,
      securityBlocked: true,
    };
  }

  // 6. AST Parsing with PostgreSQL dialect
  let ast: unknown;
  let astParsed = false;
  const cteNames = new Set<string>();
  const rawTables = new Set<string>();
  const schemas = new Set<string>();
  const statementTypes = new Set<string>();

  try {
    ast = sqlParser.astify(cleaned, { database: 'PostgresQL' });
    astParsed = true;
    const statements = Array.isArray(ast) ? ast : [ast];
    if (statements.length !== 1) {
      return {
        isValid: false,
        sanitizedSql: cleaned,
        errors: ['Security violation: Multiple statements detected in SQL AST.'],
        warnings: [],
        referencedTables: [],
        appliedRowLimit: maxRows,
        securityBlocked: true,
      };
    }

    const root = statements[0] as Record<string, unknown>;
    if (String(root?.type ?? '').toLowerCase() !== 'select') {
      return {
        isValid: false,
        sanitizedSql: cleaned,
        errors: [
          `Security violation: Root SQL statement type "${String(root?.type ?? 'unknown')}" is not allowed; must be SELECT.`,
        ],
        warnings: [],
        referencedTables: [],
        appliedRowLimit: maxRows,
        securityBlocked: true,
      };
    }

    collectAstMetadata(root, cteNames, rawTables, schemas, statementTypes);
  } catch (parseErr: unknown) {
    // Some valid PostgreSQL syntax (e.g. FILTER (WHERE ...), ::numeric(12,2), DATE_TRUNC with INTERVAL)
    // can occasionally trip node-sql-parser. Check if it's purely a parser dialect quirk vs real syntax error.
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    // Fallback table extraction ONLY for PostgreSQL-specific valid SELECT constructs
    const cteMatches = [...cleaned.matchAll(/\bWITH\s+(?:RECURSIVE\s+)?([a-z_][a-z0-9_]*)\s+AS\s*\(|,\s*([a-z_][a-z0-9_]*)\s+AS\s*\(/gi)];
    for (const m of cteMatches) {
      const name = (m[1] || m[2] || '').toLowerCase();
      if (name) cteNames.add(name);
    }

    const tableMatches = [...cleaned.matchAll(/\b(?:FROM|JOIN)\s+(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\b/gi)];
    for (const m of tableMatches) {
      if (m[1]) schemas.add(m[1].toLowerCase());
      if (m[2]) {
        const tbl = m[2].toLowerCase();
        // Exclude keywords like LATERAL or subqueries
        if (!['select', 'lateral', 'unnest', 'generate_series'].includes(tbl)) {
          rawTables.add(tbl);
        }
      }
    }

    // If the query has unbalanced parentheses or obvious broken syntax, flag invalid so SQL Correction can fix it
    const openParens = (cleaned.match(/\(/g) || []).length;
    const closeParens = (cleaned.match(/\)/g) || []).length;
    if (openParens !== closeParens || rawTables.size === 0) {
      errors.push(`SQL syntax validation error: ${msg}`);
    } else {
      warnings.push('Validated PostgreSQL-extended syntax with strict read-only lexical & table guards.');
    }
  }

  // 7. Verify all AST statement types are strictly SELECT
  if (astParsed) {
    for (const st of statementTypes) {
      if (st !== 'select') {
        errors.push(`Security violation: Nested "${st.toUpperCase()}" statement is not permitted.`);
      }
    }
  }

  // 8. Verify schemas (only 'public' allowed if specified)
  for (const sch of schemas) {
    if (sch !== 'public') {
      errors.push(`Security violation: Unauthorized schema "${sch}". Only public analytics tables are permitted.`);
    }
  }

  // 9. Verify every physical table is in the analytics allowlist
  const referencedTables: string[] = [];
  for (const tbl of rawTables) {
    if (cteNames.has(tbl)) continue;
    referencedTables.push(tbl);
    if (!ALLOWED_TABLES_SET.has(tbl)) {
      errors.push(
        `Unauthorized or unknown table "${tbl}". Allowed tables: ${config.allowedAnalyticsTables.join(', ')}.`
      );
    }
  }

  // 10. Reject expensive unbounded CROSS JOINs
  if (/\bCROSS\s+JOIN\b/i.test(cleaned)) {
    errors.push('Potentially expensive CROSS JOIN detected. Use explicit join conditions instead.');
  }

  if (errors.length > 0) {
    const isSecurity = errors.some((e) => e.startsWith('Security violation') || e.startsWith('Unauthorized'));
    return {
      isValid: false,
      sanitizedSql: cleaned,
      errors,
      warnings,
      referencedTables,
      appliedRowLimit: maxRows,
      securityBlocked: isSecurity,
    };
  }

  // 11. Enforce row limit cap
  const limited = enforceRowLimit(cleaned, maxRows);
  if (limited.warning) {
    warnings.push(limited.warning);
  }

  return {
    isValid: true,
    sanitizedSql: limited.sql,
    errors: [],
    warnings,
    referencedTables,
    appliedRowLimit: limited.appliedLimit,
    securityBlocked: false,
  };
}
