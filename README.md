# IntelliBI – Autonomous AI Data Analyst

IntelliBI is a full-stack AI business intelligence platform that enables teams to explore and query PostgreSQL databases in plain English. Questions flow through a 9-node stateful multi-agent `StateGraph` workflow that inspects live schema metadata, generates PostgreSQL SQL, validates it via AST security rules, executes it inside a serialized read-only transaction with timeout and row-limit guardrails, computes deterministic statistics, selects interactive Recharts visualizations, and synthesizes grounded executive insights.

## Key Features

- **9-Node Autonomous Multi-Agent Workflow**: Orchestrates Query Analyzer, Schema Intelligence, SQL Generation, SQL AST Validation, Read-Only SQL Execution, Bounded SQL Correction (max 2 retries), Data Analysis, Visualization Selection, and Response Generation with real-time Server-Sent Events (SSE) step streaming.
- **Embedded PostgreSQL 16 (`@electric-sql/pglite`)**: Pre-seeded with 5 relational B2B e-commerce tables (`customers`, `products`, `orders`, `order_items`, `payments`) spanning 24 months of sales data, alongside isolated application persistence tables (`app_users`, `app_query_history`, `app_reports`, `app_settings`).
- **Security-First NL-to-SQL Guardrails**:
  - PostgreSQL AST enforcement (`node-sql-parser`) restricting execution to single-statement `SELECT` and `WITH ... SELECT` queries.
  - Strict table and schema allowlisting (`public` analytics tables only; blocks internal `app_*` tables and `pg_*` / `information_schema` system catalogs).
  - Read-only database transactions (`SET TRANSACTION READ ONLY` + `statement_timeout` + `ROLLBACK`) serialized via PGlite transaction locking, paired with configurable row-limit clamping (`10–1,000`) and rate-limited AI endpoints.
- **Interactive Analytics Dashboards**: Live PostgreSQL KPI cards, revenue trends, category revenue mix, regional comparisons, and a product profitability & stock ledger with year, region, and category filters.
- **Dynamic Visualizations & Exports**: Automatic chart selection across KPI cards, Area, Line, Bar, Pie/Donut, and searchable Data Tables with Chart/Table view toggling, plus PDF, RFC-4180 CSV, and Markdown report exports.
- **Database Intelligence, Audit History & Settings**: Live schema/FK explorer with read-only sample previews, searchable query audit log with SQL inspection and reopen support, `⌘K` / `Ctrl+K` quick command search, and per-user execution guardrail settings.
- **JWT Authentication & Theme Support**: `bcryptjs` password hashing, signed JWT sessions, one-click demo workspace (`demo@intellibi.ai`), and Light/Dark interface modes.

## Workspace Pages

- `/` — **Executive Overview**: Live KPIs, YoY deltas, regional breakdown, recent query activity, and quick-launch analytical prompts.
- `/analyst` — **AI Business Analyst**: Conversational natural-language analytics console with live multi-agent trace, SQL AST viewer, dynamic charts, and report saving.
- `/dashboards` — **Interactive Dashboards**: Filterable revenue trajectories, category share, regional performance, and product ledger.
- `/data-sources` — **Database Intelligence**: Live PostgreSQL status, table column metadata, foreign-key graph, and 12-row read-only table previews.
- `/history` — **Query Audit History**: Filterable log of executed, blocked, and failed queries with SQL inspection and one-click session reopening.
- `/reports` — **Saved Reports**: Persistent analytical reports with PDF, CSV, and Markdown exports.
- `/settings` — **Workspace Settings**: Configurable SQL execution guardrails (`maxRows`, `queryTimeoutMs`), theme switcher, and account session controls.

## Technology Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Recharts, Axios, React Router, Lucide Icons, jsPDF (`jspdf-autotable`).
- **Backend**: Express, TypeScript, `@google/genai` (default `gemini-4-hydrogen`, configurable via env), `node-sql-parser`, Zod, `express-rate-limit`, `bcryptjs`, `jsonwebtoken`.
- **Database**: Embedded PostgreSQL 16 (`@electric-sql/pglite`) with standalone [database/init.sql](database/init.sql) schema compatibility.

## Project Structure

```text
├── server.ts                  # Express + Vite/static full-stack server entrypoint
├── src/
│   ├── components/            # Auth screen, AppShell, DynamicChart, SQL & trace viewers
│   ├── context/               # AuthContext and ThemeContext providers
│   ├── pages/                 # Workspace route views
│   ├── services/api.ts        # Axios API client & SSE stream consumer
│   ├── utils/formatters.ts    # Currency, number, CSV, and PDF export helpers
│   └── server/
│       ├── agents/            # Query analyzer, schema, SQL gen/validator/executor, stats, viz, response
│       ├── core/              # Env config, Gemini client & JSON parser, JWT/bcrypt auth middleware
│       ├── db/                # PGlite singleton, deterministic seed, schema inspection
│       ├── graph/             # 9-node StateGraph workflow orchestrator
│       └── routes/            # /auth, /dashboard, /analytics, /database, /reports routers
├── database/init.sql          # Standalone PostgreSQL DDL reference
├── docs/                      # Architecture & REST API reference docs
└── tests/                     # Unit tests, workflow tests, and 20-question benchmark
```

## Configuration

Create a `.env` file in the project root with your configuration:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key
LLM_PROVIDER=gemini
GEMINI_MODEL=gemini-4-hydrogen
JWT_SECRET=replace-with-a-strong-secret
MAX_QUERY_ROWS=250
QUERY_TIMEOUT_MS=5000
PGLITE_DATA_DIR=./.intellibi-pgdata
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. You can register a new account or launch the pre-seeded demo workspace (`demo@intellibi.ai` / `DemoPass123!`).

## Scripts, Testing & Evaluation

```bash
# TypeScript typecheck
npm run lint

# Production client bundle build
npm run build

# Unit & StateGraph PostgreSQL integration tests
npm test

# 20-question SQL benchmark & unsafe SQL security evaluation
npm run eval:benchmark

# Live end-to-end LLM 20-question benchmark (requires GEMINI_API_KEY)
npm run eval:benchmark -- --live
```

## Documentation

- [System & Multi-Agent Architecture](docs/architecture.md)
- [REST API Contract](docs/api.md)
