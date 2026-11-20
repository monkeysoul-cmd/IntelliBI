# IntelliBI – Autonomous AI Data Analyst

IntelliBI is a full-stack AI business intelligence platform that enables business teams to query PostgreSQL databases in plain English. Questions flow through a 9-node multi-agent StateGraph workflow that inspects live schema metadata, generates PostgreSQL SQL, validates it via AST security rules, executes it inside a read-only transaction with timeout and row limits, computes deterministic statistics, selects interactive Recharts visualizations, and synthesizes grounded executive insights.

## Key Features
- **9-Node Autonomous Multi-Agent Workflow**: Query Analyzer, Schema Intelligence, SQL Generation, SQL AST Validation, Read-Only SQL Execution, Bounded SQL Correction (max 2 retries), Data Analysis, Visualization Selection, and Response Generation.
- **Real Embedded PostgreSQL (PGlite)**: Full PostgreSQL 16 engine seeded with 5 relational e-commerce tables (`customers`, `products`, `orders`, `order_items`, `payments`) spanning 24 months of realistic B2B sales, plus isolated application persistence (`app_users`, `app_query_history`, `app_reports`, `app_settings`).
- **Interactive Analytics Dashboards**: Live PostgreSQL KPI cards, revenue trends, monthly order volume, product profitability ledger, and regional comparisons with multi-dimension filters.
- **Automatic Visualizations**: Dynamic Recharts visualizer supporting KPI cards, Area, Line, Bar, Pie/Donut, and searchable Data Tables with instant Chart/Table view toggling.
- **Security-First NL-to-SQL**: Strict `node-sql-parser` PostgreSQL AST verification, allowlisted analytics tables only, `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, `statement_timeout`, configurable `LIMIT` caps, and rate-limited AI endpoints.
- **Reports & Exports**: Save analyses to PostgreSQL and export formatted PDF reports, RFC-4180 CSV datasets, or Markdown summaries.
- **JWT Authentication & Light/Dark Mode**: bcryptjs password hashing, signed JWT sessions, per-user history/settings, and full daylight/dark themes.

## Technology Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Recharts, Axios, React Router, Lucide Icons, jsPDF.
- **Backend**: Express, TypeScript, `@google/genai` (`gemini-4-hydrogen` configurable via env), `node-sql-parser`, Zod, `express-rate-limit`, `bcryptjs`, `jsonwebtoken`.
- **Database**: Embedded PostgreSQL 16 (`@electric-sql/pglite`) with standalone `database/init.sql` schema compatibility.

## Local Development

```bash
npm install
cp .env.example .env
# Set GEMINI_API_KEY in .env
npm run dev
```

Open `http://localhost:3000`.

## Testing & Evaluation

```bash
# Run unit & workflow integration tests
npm test

# Run the 20-question benchmark & unsafe SQL security evaluation
npm run eval:benchmark

# Run live LLM end-to-end 20-question benchmark (requires GEMINI_API_KEY)
npm run eval:benchmark -- --live
```

## Docker Deployment

```bash
docker compose up --build
```

## Documentation
- [System & Multi-Agent Architecture](docs/architecture.md)
- [REST API Contract](docs/api.md)
