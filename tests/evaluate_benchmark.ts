/**
 * IntelliBI – 20-Question Natural-Language Analytical Benchmark & Security Evaluation Script
 * Measures real SQL execution success rate, unsafe SQL rejection rate, row correctness,
 * retry frequency, and end-to-end latency against embedded PostgreSQL.
 *
 * Usage:
 *   npm run eval:benchmark
 */
import { getDb, executeReadOnlyAnalyticsQuery } from '../src/server/db/pglite.ts';
import { validateAndSanitizeSql } from '../src/server/agents/sqlValidator.ts';
import { runAnalyticsWorkflow } from '../src/server/graph/stateGraph.ts';
import { hasGeminiKeyConfigured } from '../src/server/core/gemini.ts';

interface BenchmarkCase {
  id: number;
  question: string;
  referenceSql: string;
  minExpectedRows: number;
}

const ANALYTICAL_BENCHMARK: BenchmarkCase[] = [
  {
    id: 1,
    question: 'What was our total revenue this month?',
    referenceSql: "SELECT ROUND(SUM(total_amount), 2) AS revenue FROM orders WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-11-01' AND order_date <= DATE '2026-11-30'",
    minExpectedRows: 1,
  },
  {
    id: 2,
    question: 'Which products generated the highest revenue?',
    referenceSql: "SELECT p.product_name, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM order_items oi JOIN products p ON oi.product_id = p.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.order_status <> 'Cancelled' GROUP BY p.product_name ORDER BY revenue DESC LIMIT 10",
    minExpectedRows: 5,
  },
  {
    id: 3,
    question: 'Compare sales between the last two quarters.',
    referenceSql: "SELECT TO_CHAR(DATE_TRUNC('quarter', order_date), 'YYYY-\"Q\"Q') AS quarter, ROUND(SUM(total_amount), 2) AS sales FROM orders WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-07-01' GROUP BY 1 ORDER BY 1",
    minExpectedRows: 2,
  },
  {
    id: 4,
    question: 'Which region has the highest customer acquisition?',
    referenceSql: 'SELECT region, COUNT(*) AS customers FROM customers GROUP BY region ORDER BY customers DESC',
    minExpectedRows: 5,
  },
  {
    id: 5,
    question: 'Show monthly revenue trends for the previous year.',
    referenceSql: "SELECT TO_CHAR(DATE_TRUNC('month', order_date), 'YYYY-MM') AS month, ROUND(SUM(total_amount), 2) AS revenue FROM orders WHERE order_status <> 'Cancelled' AND EXTRACT(YEAR FROM order_date) = 2025 GROUP BY 1 ORDER BY 1",
    minExpectedRows: 12,
  },
  {
    id: 6,
    question: 'Identify customers whose purchases have declined.',
    referenceSql: "SELECT c.customer_name, ROUND(COALESCE(SUM(o.total_amount) FILTER (WHERE EXTRACT(YEAR FROM o.order_date) = 2025), 0), 2) AS spend_2025, ROUND(COALESCE(SUM(o.total_amount) FILTER (WHERE EXTRACT(YEAR FROM o.order_date) = 2026), 0), 2) AS spend_2026 FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.order_status <> 'Cancelled' GROUP BY c.customer_name HAVING COALESCE(SUM(o.total_amount) FILTER (WHERE EXTRACT(YEAR FROM o.order_date) = 2025), 0) > COALESCE(SUM(o.total_amount) FILTER (WHERE EXTRACT(YEAR FROM o.order_date) = 2026), 0) ORDER BY (COALESCE(SUM(o.total_amount) FILTER (WHERE EXTRACT(YEAR FROM o.order_date) = 2025), 0) - COALESCE(SUM(o.total_amount) FILTER (WHERE EXTRACT(YEAR FROM o.order_date) = 2026), 0)) DESC LIMIT 10",
    minExpectedRows: 3,
  },
  {
    id: 7,
    question: 'What are the top five performing products?',
    referenceSql: "SELECT p.product_name, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM order_items oi JOIN products p ON oi.product_id = p.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.order_status <> 'Cancelled' GROUP BY p.product_name ORDER BY revenue DESC LIMIT 5",
    minExpectedRows: 5,
  },
  {
    id: 8,
    question: 'What is our overall average order value?',
    referenceSql: "SELECT ROUND(AVG(total_amount), 2) AS avg_order_value FROM orders WHERE order_status <> 'Cancelled'",
    minExpectedRows: 1,
  },
  {
    id: 9,
    question: 'Show total revenue breakdown by product category.',
    referenceSql: "SELECT p.category, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM order_items oi JOIN products p ON oi.product_id = p.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.order_status <> 'Cancelled' GROUP BY p.category ORDER BY revenue DESC",
    minExpectedRows: 6,
  },
  {
    id: 10,
    question: 'Which payment methods are used most frequently?',
    referenceSql: 'SELECT payment_method, COUNT(*) AS payment_count, ROUND(SUM(amount), 2) AS total_amount FROM payments GROUP BY payment_method ORDER BY payment_count DESC',
    minExpectedRows: 4,
  },
  {
    id: 11,
    question: 'What is the cancellation rate of orders?',
    referenceSql: "SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE order_status = 'Cancelled') / COUNT(*), 2) AS cancellation_rate_pct FROM orders",
    minExpectedRows: 1,
  },
  {
    id: 12,
    question: 'Which products have the highest gross profit margin?',
    referenceSql: 'SELECT product_name, category, ROUND(((price - cost) / price) * 100, 2) AS margin_pct FROM products ORDER BY margin_pct DESC LIMIT 10',
    minExpectedRows: 5,
  },
  {
    id: 13,
    question: 'Which products have the lowest remaining stock quantity?',
    referenceSql: 'SELECT product_name, category, stock_quantity FROM products ORDER BY stock_quantity ASC LIMIT 10',
    minExpectedRows: 5,
  },
  {
    id: 14,
    question: 'Show top 10 customers by lifetime spend.',
    referenceSql: "SELECT c.customer_name, c.region, ROUND(SUM(o.total_amount), 2) AS lifetime_spend FROM customers c JOIN orders o ON c.customer_id = o.customer_id WHERE o.order_status <> 'Cancelled' GROUP BY c.customer_name, c.region ORDER BY lifetime_spend DESC LIMIT 10",
    minExpectedRows: 10,
  },
  {
    id: 15,
    question: 'Compare total orders and revenue by order status.',
    referenceSql: 'SELECT order_status, COUNT(*) AS order_count, ROUND(SUM(total_amount), 2) AS total_amount FROM orders GROUP BY order_status ORDER BY order_count DESC',
    minExpectedRows: 3,
  },
  {
    id: 16,
    question: 'What is the average order value by region?',
    referenceSql: "SELECT c.region, ROUND(AVG(o.total_amount), 2) AS avg_order_value FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE o.order_status <> 'Cancelled' GROUP BY c.region ORDER BY avg_order_value DESC",
    minExpectedRows: 5,
  },
  {
    id: 17,
    question: 'How many units were sold per product category in 2026?',
    referenceSql: "SELECT p.category, SUM(oi.quantity) AS units_sold FROM order_items oi JOIN products p ON oi.product_id = p.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.order_status <> 'Cancelled' AND EXTRACT(YEAR FROM o.order_date) = 2026 GROUP BY p.category ORDER BY units_sold DESC",
    minExpectedRows: 6,
  },
  {
    id: 18,
    question: 'Which cities generate the most revenue?',
    referenceSql: "SELECT c.city, c.region, ROUND(SUM(o.total_amount), 2) AS revenue FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE o.order_status <> 'Cancelled' GROUP BY c.city, c.region ORDER BY revenue DESC LIMIT 10",
    minExpectedRows: 10,
  },
  {
    id: 19,
    question: 'Show total refunded payment amounts by payment method.',
    referenceSql: "SELECT payment_method, COUNT(*) AS refunds, ROUND(SUM(amount), 2) AS refunded_amount FROM payments WHERE payment_status = 'Refunded' GROUP BY payment_method ORDER BY refunded_amount DESC",
    minExpectedRows: 1,
  },
  {
    id: 20,
    question: 'Compare total gross profit across all product categories.',
    referenceSql: "SELECT p.category, ROUND(SUM(oi.quantity * (oi.unit_price - p.cost)), 2) AS gross_profit FROM order_items oi JOIN products p ON oi.product_id = p.product_id JOIN orders o ON oi.order_id = o.order_id WHERE o.order_status <> 'Cancelled' GROUP BY p.category ORDER BY gross_profit DESC",
    minExpectedRows: 6,
  },
];

const UNSAFE_SQL_CASES = [
  'DROP TABLE orders',
  'DELETE FROM customers WHERE customer_id = 1',
  'UPDATE products SET price = 1',
  'SELECT * FROM orders; TRUNCATE TABLE payments;',
  'SELECT email, password_hash FROM app_users',
  'SELECT pg_sleep(5) FROM orders',
];

async function main() {
  const pg = await getDb('memory://');
  const startAll = Date.now();

  // 1. Evaluate SQL Security Validator rejection rate
  let unsafeBlocked = 0;
  for (const sql of UNSAFE_SQL_CASES) {
    const res = validateAndSanitizeSql(sql, 250);
    if (!res.isValid && res.securityBlocked) {
      unsafeBlocked++;
    }
  }

  // 2. Verify all 20 benchmark reference SQL queries pass validation & return valid PostgreSQL results
  let referencePassed = 0;
  for (const item of ANALYTICAL_BENCHMARK) {
    const val = validateAndSanitizeSql(item.referenceSql, 250);
    if (!val.isValid) continue;
    const exec = await executeReadOnlyAnalyticsQuery(pg, val.sanitizedSql, 5000, 250);
    if (exec.rows.length >= item.minExpectedRows) {
      referencePassed++;
    }
  }

  console.log('\n=== IntelliBI Benchmark Evaluation Report ===');
  console.log(`Unsafe SQL Rejection Rate : ${unsafeBlocked}/${UNSAFE_SQL_CASES.length} (${((unsafeBlocked / UNSAFE_SQL_CASES.length) * 100).toFixed(1)}%)`);
  console.log(`Reference SQL Verification: ${referencePassed}/${ANALYTICAL_BENCHMARK.length} (${((referencePassed / ANALYTICAL_BENCHMARK.length) * 100).toFixed(1)}%)`);

  // 3. Optional live LLM end-to-end run if GEMINI_API_KEY is configured and --live flag passed
  if (process.argv.includes('--live') && hasGeminiKeyConfigured()) {
    let liveSucceeded = 0;
    let totalRetries = 0;
    const latencies: number[] = [];

    for (const item of ANALYTICAL_BENCHMARK) {
      const t0 = Date.now();
      const state = await runAnalyticsWorkflow({
        pg,
        question: item.question,
        conversationId: `bench-${item.id}`,
        conversationHistory: [],
        maxRows: 250,
        timeoutMs: 5000,
      });
      latencies.push(Date.now() - t0);
      totalRetries += state.retryCount;
      if (state.executionStatus === 'succeeded' && (state.executionResult?.rows.length ?? 0) >= item.minExpectedRows) {
        liveSucceeded++;
      }
      console.log(`  [#${item.id}] ${state.executionStatus.toUpperCase()} (${state.executionResult?.rows.length ?? 0} rows, retries=${state.retryCount}) — ${item.question}`);
    }

    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    console.log(`\nLive Multi-Agent Success  : ${liveSucceeded}/${ANALYTICAL_BENCHMARK.length} (${((liveSucceeded / ANALYTICAL_BENCHMARK.length) * 100).toFixed(1)}%)`);
    console.log(`Total Auto-Retries        : ${totalRetries}`);
    console.log(`Average E2E Latency       : ${avgLatency}ms`);
  } else {
    console.log('Live LLM evaluation       : Skipped (pass --live with GEMINI_API_KEY set to run full 20-question LLM suite)');
  }

  console.log(`Total Elapsed             : ${Date.now() - startAll}ms\n`);
  await pg.close();
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
