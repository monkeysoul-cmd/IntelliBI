import { Router } from 'express';
import { getDb } from '../db/pglite.ts';
import { requireAuth, type AuthRequest } from '../core/auth.ts';

const router = Router();

router.use(requireAuth);

router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const pg = await getDb();

    // Core KPIs computed directly from live PostgreSQL records
    const kpiRes = await pg.query<{
      total_revenue: string;
      total_orders: string;
      avg_order_value: string;
      completed_orders: string;
      rev_current_quarter: string;
      rev_prev_quarter: string;
      orders_current_quarter: string;
      orders_prev_quarter: string;
    }>(`
      SELECT
        COALESCE(ROUND(SUM(total_amount) FILTER (WHERE order_status <> 'Cancelled'), 2), 0)::text AS total_revenue,
        COUNT(*) FILTER (WHERE order_status <> 'Cancelled')::text AS total_orders,
        COALESCE(ROUND(AVG(total_amount) FILTER (WHERE order_status <> 'Cancelled'), 2), 0)::text AS avg_order_value,
        COUNT(*) FILTER (WHERE order_status = 'Completed')::text AS completed_orders,
        COALESCE(ROUND(SUM(total_amount) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-07-01' AND order_date <= DATE '2026-09-30'), 2), 0)::text AS rev_prev_quarter,
        COALESCE(ROUND(SUM(total_amount) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-10-01'), 2), 0)::text AS rev_current_quarter,
        COUNT(*) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-07-01' AND order_date <= DATE '2026-09-30')::text AS orders_prev_quarter,
        COUNT(*) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-10-01')::text AS orders_current_quarter
      FROM orders
    `);

    const custRes = await pg.query<{
      total_customers: string;
      new_customers_2026: string;
      active_buyers: string;
    }>(`
      SELECT
        COUNT(*)::text AS total_customers,
        COUNT(*) FILTER (WHERE created_at >= TIMESTAMP '2026-01-01')::text AS new_customers_2026,
        (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE order_status <> 'Cancelled')::text AS active_buyers
      FROM customers
    `);

    // Compare 2026 YTD vs 2025 equivalent period for YoY growth delta
    const yoyRes = await pg.query<{
      rev_2026: string;
      rev_2025: string;
      ord_2026: string;
      ord_2025: string;
      aov_2026: string;
      aov_2025: string;
    }>(`
      SELECT
        COALESCE(ROUND(SUM(total_amount) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-01-01' AND order_date <= DATE '2026-11-20'), 2), 0)::text AS rev_2026,
        COALESCE(ROUND(SUM(total_amount) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2025-01-01' AND order_date <= DATE '2025-11-20'), 2), 0)::text AS rev_2025,
        COUNT(*) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-01-01' AND order_date <= DATE '2026-11-20')::text AS ord_2026,
        COUNT(*) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2025-01-01' AND order_date <= DATE '2025-11-20')::text AS ord_2025,
        COALESCE(ROUND(AVG(total_amount) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2026-01-01' AND order_date <= DATE '2026-11-20'), 2), 0)::text AS aov_2026,
        COALESCE(ROUND(AVG(total_amount) FILTER (WHERE order_status <> 'Cancelled' AND order_date >= DATE '2025-01-01' AND order_date <= DATE '2025-11-20'), 2), 0)::text AS aov_2025
      FROM orders
    `);

    const recentQueriesRes = await pg.query<{
      id: number;
      question: string;
      execution_status: string;
      execution_time_ms: number;
      row_count: number;
      result_summary: string | null;
      created_at: string;
    }>(
      `SELECT id, question, execution_status, execution_time_ms, row_count, result_summary, created_at::text
       FROM app_query_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [req.user!.id]
    );

    const k = kpiRes.rows[0];
    const c = custRes.rows[0];
    const y = yoyRes.rows[0];

    const rev2026 = Number(y.rev_2026);
    const rev2025 = Number(y.rev_2025);
    const ord2026 = Number(y.ord_2026);
    const ord2025 = Number(y.ord_2025);
    const aov2026 = Number(y.aov_2026);
    const aov2025 = Number(y.aov_2025);

    const pctDelta = (cur: number, prev: number) =>
      prev > 0 ? Number((((cur - prev) / prev) * 100).toFixed(1)) : 0;

    res.json({
      kpis: {
        totalRevenue: Number(k.total_revenue),
        revenueGrowthPct: pctDelta(rev2026, rev2025),
        totalOrders: Number(k.total_orders),
        ordersGrowthPct: pctDelta(ord2026, ord2025),
        totalCustomers: Number(c.total_customers),
        newCustomers2026: Number(c.new_customers_2026),
        activeBuyers: Number(c.active_buyers),
        avgOrderValue: Number(k.avg_order_value),
        aovGrowthPct: pctDelta(aov2026, aov2025),
      },
      recentQueries: recentQueriesRes.rows.map((r) => ({
        id: r.id,
        question: r.question,
        executionStatus: r.execution_status,
        executionTimeMs: r.execution_time_ms,
        rowCount: r.row_count,
        resultSummary: r.result_summary,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({ error: 'Failed to load executive KPIs from PostgreSQL.' });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const pg = await getDb();
    const year = typeof req.query.year === 'string' ? req.query.year : 'all';
    const region = typeof req.query.region === 'string' ? req.query.region : 'all';
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';

    const params: unknown[] = [];
    const conditions: string[] = ["o.order_status <> 'Cancelled'"];

    if (year === '2025' || year === '2026') {
      params.push(Number(year));
      conditions.push(`EXTRACT(YEAR FROM o.order_date) = $${params.length}`);
    }
    if (region && region !== 'all') {
      params.push(region);
      conditions.push(`c.region = $${params.length}`);
    }
    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`p.category = $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql =
      category && category !== 'all'
        ? `
          SELECT
            TO_CHAR(DATE_TRUNC('month', o.order_date), 'YYYY-MM') AS month,
            ROUND(SUM(oi.quantity * oi.unit_price), 2)::float AS revenue,
            COUNT(DISTINCT o.order_id)::int AS orders,
            ROUND(SUM(oi.quantity * (oi.unit_price - p.cost)), 2)::float AS gross_profit
          FROM orders o
          JOIN customers c ON o.customer_id = c.customer_id
          JOIN order_items oi ON o.order_id = oi.order_id
          JOIN products p ON oi.product_id = p.product_id
          ${whereClause}
          GROUP BY 1
          ORDER BY 1 ASC
        `
        : `
          SELECT
            TO_CHAR(DATE_TRUNC('month', o.order_date), 'YYYY-MM') AS month,
            ROUND(SUM(o.total_amount), 2)::float AS revenue,
            COUNT(o.order_id)::int AS orders,
            ROUND(AVG(o.total_amount), 2)::float AS avg_order_value
          FROM orders o
          JOIN customers c ON o.customer_id = c.customer_id
          ${whereClause}
          GROUP BY 1
          ORDER BY 1 ASC
        `;

    const result = await pg.query(sql, params);
    res.json({ series: result.rows });
  } catch (err) {
    console.error('Dashboard revenue error:', err);
    res.status(500).json({ error: 'Failed to load revenue analytics.' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const pg = await getDb();
    const year = typeof req.query.year === 'string' ? req.query.year : 'all';
    const region = typeof req.query.region === 'string' ? req.query.region : 'all';
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const limit = Math.min(Math.max(Number(req.query.limit || 8), 3), 24);

    const params: unknown[] = [];
    const conditions: string[] = ["o.order_status <> 'Cancelled'"];

    if (year === '2025' || year === '2026') {
      params.push(Number(year));
      conditions.push(`EXTRACT(YEAR FROM o.order_date) = $${params.length}`);
    }
    if (region && region !== 'all') {
      params.push(region);
      conditions.push(`c.region = $${params.length}`);
    }
    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`p.category = $${params.length}`);
    }

    params.push(limit);

    const result = await pg.query(
      `SELECT
         p.product_id,
         p.product_name,
         p.category,
         p.price::float AS unit_price,
         p.stock_quantity::int AS stock_quantity,
         SUM(oi.quantity)::int AS units_sold,
         ROUND(SUM(oi.quantity * oi.unit_price), 2)::float AS revenue,
         ROUND(SUM(oi.quantity * (oi.unit_price - p.cost)), 2)::float AS gross_profit,
         ROUND(
           CASE WHEN SUM(oi.quantity * oi.unit_price) > 0
             THEN (SUM(oi.quantity * (oi.unit_price - p.cost)) / SUM(oi.quantity * oi.unit_price)) * 100
             ELSE 0
           END, 1
         )::float AS margin_pct
       FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id
       JOIN orders o ON oi.order_id = o.order_id
       JOIN customers c ON o.customer_id = c.customer_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY p.product_id, p.product_name, p.category, p.price, p.stock_quantity
       ORDER BY revenue DESC
       LIMIT $${params.length}`,
      params
    );

    const categoriesRes = await pg.query<{ category: string }>(
      'SELECT DISTINCT category FROM products ORDER BY category ASC'
    );

    res.json({
      products: result.rows,
      categories: categoriesRes.rows.map((r) => r.category),
    });
  } catch (err) {
    console.error('Dashboard products error:', err);
    res.status(500).json({ error: 'Failed to load product analytics.' });
  }
});

router.get('/regions', async (req, res) => {
  try {
    const pg = await getDb();
    const year = typeof req.query.year === 'string' ? req.query.year : 'all';
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';

    const params: unknown[] = [];
    const conditions: string[] = ["o.order_status <> 'Cancelled'"];

    if (year === '2025' || year === '2026') {
      params.push(Number(year));
      conditions.push(`EXTRACT(YEAR FROM o.order_date) = $${params.length}`);
    }
    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`p.category = $${params.length}`);
    }

    const sql =
      category && category !== 'all'
        ? `
          SELECT
            c.region,
            COUNT(DISTINCT c.customer_id)::int AS customers,
            COUNT(DISTINCT o.order_id)::int AS orders,
            ROUND(SUM(oi.quantity * oi.unit_price), 2)::float AS revenue,
            ROUND(SUM(oi.quantity * oi.unit_price) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2)::float AS avg_order_value
          FROM customers c
          JOIN orders o ON c.customer_id = o.customer_id
          JOIN order_items oi ON o.order_id = oi.order_id
          JOIN products p ON oi.product_id = p.product_id
          WHERE ${conditions.join(' AND ')}
          GROUP BY c.region
          ORDER BY revenue DESC
        `
        : `
          SELECT
            c.region,
            COUNT(DISTINCT c.customer_id)::int AS customers,
            COUNT(o.order_id)::int AS orders,
            COALESCE(ROUND(SUM(o.total_amount), 2), 0)::float AS revenue,
            COALESCE(ROUND(AVG(o.total_amount), 2), 0)::float AS avg_order_value
          FROM customers c
          LEFT JOIN orders o ON c.customer_id = o.customer_id AND ${conditions.join(' AND ')}
          GROUP BY c.region
          ORDER BY revenue DESC
        `;

    const result = await pg.query(sql, params);

    const catBreakdown = await pg.query(
      `SELECT
         p.category,
         ROUND(SUM(oi.quantity * oi.unit_price), 2)::float AS revenue,
         SUM(oi.quantity)::int AS units_sold
       FROM order_items oi
       JOIN products p ON oi.product_id = p.product_id
       JOIN orders o ON oi.order_id = o.order_id
       WHERE o.order_status <> 'Cancelled'
       GROUP BY p.category
       ORDER BY revenue DESC`
    );

    res.json({
      regions: result.rows,
      categories: catBreakdown.rows,
    });
  } catch (err) {
    console.error('Dashboard regions error:', err);
    res.status(500).json({ error: 'Failed to load regional sales analytics.' });
  }
});

export default router;
