# IntelliBI – Multi-Agent System Architecture

IntelliBI implements a 9-node stateful directed graph (`src/server/graph/stateGraph.ts`) modeled on LangGraph's `StateGraph` architecture, pairing Gemini structured JSON reasoning with strict PostgreSQL AST security validation and read-only execution.

## Workflow Diagram

```
User Question + Conversation History
  │
  ▼
[Node 1: User Query Analyzer] ──(unsafe / unclear)──▶ End (Blocked or Clarification)
  │ (analytical_query)
  ▼
[Node 2: Schema Intelligence Agent]  (Live PostgreSQL information_schema & FK inspection)
  │
  ▼
[Node 3: SQL Generation Agent]       (Schema-grounded PostgreSQL SELECT + explanation)
  │
  ▼
[Node 4: SQL Validation Agent] ──(security violation)──▶ End (Blocked)
  │ (valid AST + LIMIT enforced)         ▲
  ▼                                      │ (retryCount < 2)
[Node 5: SQL Execution Agent] ──(error)──┴──▶ [Node 6: SQL Correction Agent]
  │ (succeeded)
  ▼
[Node 7: Data Analysis Agent]        (Deterministic math: sums, means, trends, z-score outliers)
  │
  ▼
[Node 8: Visualization Agent]        (Auto-selects KPI, Area, Line, Bar, Pie, or Table)
  │
  ▼
[Node 9: Response Generation Agent]  (Grounded executive summary, insights & recommendations)
  │
  ▼
Persist to app_query_history + Stream Result to React Dashboard
```

## Security Controls

1. **AST Enforcement (`node-sql-parser`)**: Every AI-generated query is parsed in PostgreSQL dialect. Only single-statement read-only `SELECT` and `WITH ... SELECT` CTEs are permitted.
2. **Table & Schema Allowlist**: Only `customers`, `products`, `orders`, `order_items`, and `payments` in `public` are accessible. Internal application tables (`app_users`, `app_query_history`, `app_reports`, `app_settings`) and system catalogs (`pg_catalog`, `information_schema`) are denied.
3. **Database-Level Read-Only Transaction**: Execution always runs inside `BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout = ...; ... ROLLBACK;` so no write can ever commit.
4. **Bounded Retry Loop**: Node 6 (SQL Correction) retries a maximum of 2 times on recoverable execution or syntax errors, preventing infinite LLM loops. Security violations are never retried.
