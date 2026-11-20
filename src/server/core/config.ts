import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  llmProvider: process.env.LLM_PROVIDER || 'gemini',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-4-hydrogen',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  jwtSecret:
    process.env.JWT_SECRET || 'intellibi-local-dev-jwt-secret-key-2026-change-in-prod',
  jwtExpiresIn: '7d',
  defaultMaxQueryRows: Math.min(Math.max(Number(process.env.MAX_QUERY_ROWS || 250), 10), 1000),
  defaultQueryTimeoutMs: Math.min(
    Math.max(Number(process.env.QUERY_TIMEOUT_MS || 5000), 1000),
    30000
  ),
  pgliteDataDir: process.env.PGLITE_DATA_DIR || './.intellibi-pgdata',
  allowedAnalyticsTables: [
    'customers',
    'products',
    'orders',
    'order_items',
    'payments',
  ] as const,
} as const;

export type AllowedAnalyticsTable = (typeof config.allowedAnalyticsTables)[number];
