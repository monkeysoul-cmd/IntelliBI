import pkg from 'node-sql-parser';
import { config } from '../core/config.ts';
import type { SqlValidationResult } from './types.ts';

const { Parser } = pkg;
const sqlParser = new Parser();

const FORBIDDEN_KEYWORDS_REGEX =
/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE\s+INTO|GRANT|REVOKE|COPY|EXECUTE|EXEC|CALL|DO|VACUUM|ANALYZE|LOCK|MERGE|SET\s+ROLE|SET\s+SESSION|RESET\s+ALL|LISTEN|NOTIFY|PREPARE|DEALLOCATE|DISCARD|REINDEX|CLUSTER|COMMENT\s+ON)\b/i;

const FORBIDDEN_FUNCTIONS_REGEX =
  /\b(pg_sleep|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|pg_terminate_backend|pg_cancel_backend|lo_import|lo_export|dblink|dblink_exec|query_to_xml|current_setting|set_config)\s*\(/i;

const FORBIDDEN_SCHEMAS_OR_TABLES_REGEX =
/\b(pg_[a-z0-9_]*|information_schema|app_users|app_query_history|app_reports|app_settings)\b/i;

const ALLOWED_TABLES_SET = new Set<string>(config.allowedAnalyticsTables);

  /**
   * Strips SQL comments and replaces string literal contents with empty quotes ''
   * so lexical security scans never trigger false positives on user text literals
   * and comments cannot hide dangerous tokens.
   */
  function stripCommentsAndMaskLiterals(sql: string, stripCommentsOnly = false): string {
    let out = '';
    let i = 0;
    while (i < sql.length) {
      const ch = sql[i];
      const next = i + 1 < sql.length ? sql[i + 1] : '';

      // Single-line comment -- ...
      if (ch === '-' && next === '-') {
        while (i < sql.length && sql[i] !== '\n' && sql[i] !== '\r') i++;
        out += ' ';
        continue;
      }

      // Block comment /* ... */
      if (ch === '/' && next === '*') {
        i += 2;
        while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i += 2;
        out += ' ';
        continue;
      }

      // Single-quoted string literal (PostgreSQL standard strings: '' escapes ')
      if (ch === "'") {
        if (stripCommentsOnly) out += ch;
        else out += "'";
        i++;
        while (i < sql.length) {
          if (sql[i] === "'") {
            if (sql[i + 1] === "'") {
              if (stripCommentsOnly) out += "''";
              i += 2;
              continue;
            }
            if (stripCommentsOnly) out += "'";
            else out += "'";
            i++;
            break;
          }
          if (stripCommentsOnly) out += sql[i];
          i++;
        }
        continue;
      }

      // Double-quoted identifier
      if (ch === '"') {
        out += ch;
        i++;
        while (i < sql.length) {
          out += sql[i];
          if (sql[i] === '"') {
            if (sql[i + 1] === '"') {
              out += '"';
              i += 2;
              continue;
            }
            i++;
            break;
          }
          i++;
        }
        continue;
      }

      // PostgreSQL dollar-quoted string $tag$...$tag$
      if (ch === '$') {
        const match = sql.slice(i).match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)?\$/);
        if (match) {
          const tag = match[0];
          const endIdx = sql.indexOf(tag, i + tag.length);
          if (endIdx !== -1) {
            if (stripCommentsOnly) {
              out += sql.slice(i, endIdx + tag.length);
            } else {
              out += "''";
            }
            i = endIdx + tag.length;
            continue;
          }
        }
      }

      out += ch;
      i++;
    }
    return out.trim();
  }

  function stripTrailingSemicolon(sql: string): string {
    return sql.replace(/;\s*$/, '').trim();
  }

  function hasMultipleStatements(cleanedSql: string): boolean {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < cleanedSql.length; i++) {
      const ch = cleanedSql[i];
        if (ch === "'" && !inDouble) {
          if (inSingle && cleanedSql[i + 1] === "'") {
            i++; // Skip escaped '' in PostgreSQL string literal
            continue;
          }
          inSingle = !inSingle;
        } else if (ch === '"' && !inSingle) {
          if (inDouble && cleanedSql[i + 1] === '"') {
            i++;
            continue;
          }
          inDouble = !inDouble;
        } else if (ch === '$' && !inSingle && !inDouble) {
          const match = cleanedSql.slice(i).match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)?\$/);
          if (match) {
            const tag = match[0];
            const endIdx = cleanedSql.indexOf(tag, i + tag.length);
            if (endIdx !== -1) {
              i = endIdx + tag.length - 1;
              continue;
            }
          }
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
      const safeMax = Number.isFinite(maxRows)
        ? Math.min(Math.max(Math.floor(maxRows), 1), 1000)
        : config.defaultMaxQueryRows;

      // Handle LIMIT ALL / LIMIT NULL
      if (/\bLIMIT\s+(?:ALL|NULL)(\s+OFFSET\s+\d+)?\s*$/i.test(sql)) {
        const clampedSql = sql.replace(
          /\bLIMIT\s+(?:ALL|NULL)(\s+OFFSET\s+\d+)?\s*$/i,
          (_, offsetPart = '') => `LIMIT ${safeMax}${offsetPart}`
        );
        return {
          sql: clampedSql,
          appliedLimit: safeMax,
          warning: `Replaced unbounded LIMIT with maximum allowed ${safeMax} rows.`,
        };
      }

      // Handle FETCH FIRST / NEXT N ROWS ONLY
      const fetchMatch = sql.match(/\bFETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY\s*$/i);
      if (fetchMatch) {
        const requestedFetch = Number(fetchMatch[1]);
        if (requestedFetch > safeMax) {
          const clampedSql = sql.replace(
            /\bFETCH\s+(?:FIRST|NEXT)\s+\d+\s+ROWS?\s+ONLY\s*$/i,
            `FETCH FIRST ${safeMax} ROWS ONLY`
          );
          return {
            sql: clampedSql,
            appliedLimit: safeMax,
            warning: `Clamped requested FETCH ${requestedFetch} to maximum allowed ${safeMax} rows.`,
          };
        }
        return { sql, appliedLimit: requestedFetch };
      }

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

      const noComments = stripCommentsAndMaskLiterals(unfenced, true);
      const cleaned = stripTrailingSemicolon(noComments);
      const scanTarget = stripTrailingSemicolon(stripCommentsAndMaskLiterals(unfenced, false));

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
      const forbiddenKw = scanTarget.match(FORBIDDEN_KEYWORDS_REGEX);
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
      const forbiddenFn = scanTarget.match(FORBIDDEN_FUNCTIONS_REGEX);
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
      const forbiddenSchema = scanTarget.match(FORBIDDEN_SCHEMAS_OR_TABLES_REGEX);
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
        // Strip PostgreSQL expressions that legitimately contain FROM inside parentheses (EXTRACT, TRIM, SUBSTRING, OVERLAY)
        const stripFromFunctions = (input: string): string => {
          const re = /\b(?:EXTRACT|TRIM|SUBSTRING|OVERLAY)\s*\(/gi;
          let result = '';
          let cursor = 0;
          let match: RegExpExecArray | null;
          while ((match = re.exec(input)) !== null) {
            result += input.slice(cursor, match.index) + ' __pg_expr__ ';
            let depth = 1;
            let pos = re.lastIndex;
            while (pos < input.length && depth > 0) {
              if (input[pos] === '(') depth++;
              else if (input[pos] === ')') depth--;
              pos++;
            }
            cursor = pos;
            re.lastIndex = pos;
          }
          return result + input.slice(cursor);
        };
        const fallbackTarget = stripFromFunctions(scanTarget);

        // Fallback table extraction ONLY for PostgreSQL-specific valid SELECT constructs
        const cteMatches = [...fallbackTarget.matchAll(/\bWITH\s+(?:RECURSIVE\s+)?([a-z_][a-z0-9_]*)\s+AS\s*\(|,\s*([a-z_][a-z0-9_]*)\s+AS\s*\(/gi)];
        for (const m of cteMatches) {
          const name = (m[1] || m[2] || '').toLowerCase();
          if (name) cteNames.add(name);
        }

        const unquoteIdent = (raw: string) => raw.replace(/^"|"$/g, '').toLowerCase();
        const tableMatches = [
          ...fallbackTarget.matchAll(
            /\b(?:FROM|JOIN)\s+(?:([a-z_][a-z0-9_]*|"[^"]+")\.)?([a-z_][a-z0-9_]*|"[^"]+")/gi
          ),
        ];
        for (const m of tableMatches) {
          if (m[1]) schemas.add(unquoteIdent(m[1]));
          if (m[2]) {
            const tbl = unquoteIdent(m[2]);
            // Exclude keywords like LATERAL or subqueries
            if (!['select', 'lateral', 'unnest', 'generate_series'].includes(tbl)) {
              rawTables.add(tbl);
            }
          }
        }

        // Also catch comma-separated FROM tables (e.g. FROM orders o, secret_table s)
        const fromClauseMatches = [
          ...fallbackTarget.matchAll(
            /\bFROM\s+([^;()]+?)(?=\b(?:WHERE|GROUP|HAVING|ORDER|LIMIT|FETCH|UNION|INTERSECT|EXCEPT|JOIN|LEFT|RIGHT|INNER|OUTER|FULL)\b|$)/gi
          ),
        ];
        for (const fc of fromClauseMatches) {
          for (const part of fc[1].split(',').slice(1)) {
            const commaTbl = part.trim().match(/^(?:([a-z_][a-z0-9_]*|"[^"]+")\.)?([a-z_][a-z0-9_]*|"[^"]+")(?:\s+(?:AS\s+)?[a-z_][a-z0-9_]*)?\s*$/i);
            if (commaTbl) {
              if (commaTbl[1]) schemas.add(unquoteIdent(commaTbl[1]));
              if (commaTbl[2]) rawTables.add(unquoteIdent(commaTbl[2]));
            }
          }
        }

        // If the query has unbalanced parentheses or obvious broken syntax, flag invalid so SQL Correction can fix it
        const openParens = (scanTarget.match(/\(/g) || []).length;
        const closeParens = (scanTarget.match(/\)/g) || []).length;
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
        if (/\bCROSS\s+JOIN\b/i.test(scanTarget)) {
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
