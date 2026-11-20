# IntelliBI REST API Reference

All protected routes require `Authorization: Bearer <jwt_token>`.

## Health
- `GET /api/health` — Returns service and PostgreSQL readiness status.

## Authentication
- `POST /api/auth/register` — Register a new user account (`name`, `email`, `password`). Returns JWT + user profile + workspace settings.
- `POST /api/auth/login` — Authenticate existing user (`email`, `password`). Returns JWT + user profile + workspace settings.
- `POST /api/auth/demo` — Issues a signed JWT for the pre-seeded analyst demo workspace.
- `GET /api/auth/me` — Returns current authenticated user and settings.
- `PATCH /api/auth/settings` — Updates user query guardrails (`maxRows`, `queryTimeoutMs`).

## Analytics (Multi-Agent Workflow)
- `POST /api/analytics/query` — Executes the 9-node StateGraph workflow and persists the record in `app_query_history`.
- `POST /api/analytics/query/stream` — Server-Sent Events (SSE) stream emitting real-time `node_start`, `node_complete`, and final `result` payloads.
- `GET /api/analytics/history` — Lists persisted queries for the authenticated user (supports `?search=` and `?status=`).
- `GET /api/analytics/history/:queryId` — Retrieves a full saved analytical query including rows, SQL, visualization config, and pipeline trace.
- `POST /api/analytics/feedback` — Stores user feedback (`helpful` | `needs_improvement`) on a query record.

## Executive Dashboard (Live PostgreSQL)
- `GET /api/dashboard/overview` — Live Total Revenue, Total Orders, Total Customers, Average Order Value, YoY deltas, and recent queries.
- `GET /api/dashboard/revenue` — Monthly revenue & order trend (`?year=&region=&category=`).
- `GET /api/dashboard/products` — Top products with units sold, revenue, gross profit, and margin (`?year=&region=&category=&limit=`).
- `GET /api/dashboard/regions` — Regional sales, account counts, AOV, and category mix.

## Database Intelligence
- `GET /api/database/status` — Engine status, latency, table/record counts, and active LLM model metadata.
- `GET /api/database/schema` — Live PostgreSQL `information_schema` tables, columns, primary keys, and foreign-key relationships.
- `GET /api/database/tables` — Analytics tables summary.
- `GET /api/database/tables/:tableName/preview` — Read-only preview of first 12 rows from an allowlisted analytics table.

## Reports
- `POST /api/reports/generate` — Saves an analytical report to PostgreSQL `app_reports`.
- `GET /api/reports` — Lists user's saved reports.
- `GET /api/reports/:reportId` — Fetches a single report.
- `DELETE /api/reports/:reportId` — Deletes a saved report.
- `GET /api/reports/:reportId/download?format=csv|md` — Downloads report results as CSV or Markdown summary.
