import type { PGlite } from '@electric-sql/pglite';
import { formatSchemaForPrompt, inspectAnalyticsSchema } from '../db/schemaInfo.ts';
import type { QueryAnalysisResult, SchemaContextResult } from './types.ts';

/**
 * Node 2: Schema Intelligence Agent
 * Inspects live PostgreSQL schema, resolves foreign-key join paths, and selects
 * only the relevant tables & business metric definitions needed for SQL generation.
 */
export async function gatherSchemaIntelligence(
  pg: PGlite,
  question: string,
  analysis: QueryAnalysisResult
): Promise<SchemaContextResult> {
  const fullSchema = await inspectAnalyticsSchema(pg);
  const corpus = `${question} ${analysis.metrics.join(' ')} ${analysis.dimensions.join(' ')} ${analysis.filters.join(' ')}`.toLowerCase();

  const selected = new Set<string>();

  if (/(customer|client|account|buyer|city|region|acquisition|churn|declin|retention)/.test(corpus)) {
    selected.add('customers');
    selected.add('orders');
  }
  if (/(product|sku|category|catalog|inventory|stock|margin|profit|cost|unit|top.*perform|best.*sell)/.test(corpus)) {
    selected.add('products');
    selected.add('order_items');
    selected.add('orders');
  }
  if (/(order|revenue|sales|quarter|month|year|aov|average order|trend|status|cancel)/.test(corpus)) {
    selected.add('orders');
  }
  if (/(payment|method|credit card|wire|ach|paypal|invoice|refund|settled)/.test(corpus)) {
    selected.add('payments');
    selected.add('orders');
  }

  // If question is broad or spans multiple areas, include all 5 analytics tables so joins never fail
  if (selected.size === 0 || /(overall|overview|compare|everything|summary|company)/.test(corpus)) {
    for (const t of fullSchema.tables) {
      selected.add(t.name);
    }
  }

  const relevantTables = Array.from(selected);
  const formattedSchema = formatSchemaForPrompt(fullSchema, relevantTables);

  const businessMetricsNotes = [
    'Realized Revenue = SUM(orders.total_amount) WHERE orders.order_status <> \'Cancelled\'',
    'Product Line Revenue = SUM(order_items.quantity * order_items.unit_price) joined to non-cancelled orders',
    'Gross Profit = SUM(order_items.quantity * (order_items.unit_price - products.cost))',
    'Average Order Value (AOV) = ROUND(AVG(orders.total_amount), 2)',
    'Current Month = November 2026 (order_date >= DATE \'2026-11-01\' AND order_date <= DATE \'2026-11-30\')',
    'Previous Year = 2025 (order_date >= DATE \'2025-01-01\' AND order_date < DATE \'2026-01-01\')',
    'Last Two Quarters = Q3 2026 (2026-07-01..2026-09-30) vs Q4 2026 (2026-10-01..2026-11-30) or Q2 vs Q3 2026',
  ];

  return {
    relevantTables,
    formattedSchema,
    businessMetricsNotes,
    fullSchema,
  };
}
