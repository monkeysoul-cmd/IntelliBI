import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import { config } from '../core/config.ts';
import { selectVisualization } from '../agents/visualizationAgent.ts';

let dbInstance: PGlite | null = null;
let initPromise: Promise<PGlite> | null = null;

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export async function getDb(customDataDir?: string): Promise<PGlite> {
  if (dbInstance && !customDataDir) {
    return dbInstance;
  }
  if (initPromise && !customDataDir) {
    return initPromise;
  }

  const targetDir = customDataDir ?? config.pgliteDataDir;
  const loader = async () => {
    const pg =
      targetDir === 'memory://' ? new PGlite() : new PGlite(targetDir);
    await pg.waitReady;
    await initializeSchemaAndSeed(pg);
    if (!customDataDir) {
      dbInstance = pg;
    }
    return pg;
  };

  if (customDataDir) {
    return loader();
  }

  initPromise = loader().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

const DDL_SQL = `
CREATE TABLE IF NOT EXISTS customers (
  customer_id SERIAL PRIMARY KEY,
  customer_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  city VARCHAR(80) NOT NULL,
  region VARCHAR(60) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  product_id SERIAL PRIMARY KEY,
  product_name VARCHAR(140) NOT NULL,
  category VARCHAR(80) NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  cost NUMERIC(10, 2) NOT NULL CHECK (cost >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  order_date DATE NOT NULL,
  order_status VARCHAR(30) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0)
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  payment_method VARCHAR(50) NOT NULL,
  payment_status VARCHAR(30) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_customers_region ON customers(region);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- Application persistence tables (isolated from AI analytics SQL queries)
CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'analyst',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  user_id INTEGER PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  max_rows INTEGER NOT NULL DEFAULT 250,
  query_timeout_ms INTEGER NOT NULL DEFAULT 5000,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_query_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  conversation_id VARCHAR(80) NOT NULL,
  question TEXT NOT NULL,
  generated_sql TEXT,
  sql_explanation TEXT,
  validation_status VARCHAR(30) NOT NULL,
  execution_status VARCHAR(30) NOT NULL,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  result_summary TEXT,
  result_payload JSONB,
  visualization_config JSONB,
  insights_payload JSONB,
  pipeline_trace JSONB,
  feedback VARCHAR(20),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_query_history_user ON app_query_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  query_history_id INTEGER REFERENCES app_query_history(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  question TEXT NOT NULL,
  generated_sql TEXT,
  summary TEXT,
  insights_payload JSONB,
  visualization_config JSONB,
  result_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_reports_user ON app_reports(user_id, created_at DESC);
`;

const SEED_PRODUCTS = [
  { name: 'ProDock Thunderbolt 5 Hub', category: 'Workstation Gear', price: 349.0, cost: 162.0, stock: 185 },
  { name: 'UltraView 38" 5K Curved Monitor', category: 'Workstation Gear', price: 1299.0, cost: 740.0, stock: 64 },
  { name: 'KeyCraft Mechanical Aluminum Keyboard', category: 'Workstation Gear', price: 219.0, cost: 92.0, stock: 310 },
  { name: 'ErgoLift Dual Monitor Arm', category: 'Workstation Gear', price: 189.0, cost: 78.0, stock: 240 },
  { name: 'EdgeRack 24-Port 10GbE Switch', category: 'Networking', price: 899.0, cost: 455.0, stock: 72 },
  { name: 'MeshCore Wi-Fi 7 Enterprise Access Point', category: 'Networking', price: 549.0, cost: 268.0, stock: 140 },
  { name: 'FiberLink SFP+ Transceiver Pack', category: 'Networking', price: 159.0, cost: 64.0, stock: 420 },
  { name: 'NetGuard Hardware VPN Gateway', category: 'Networking', price: 749.0, cost: 360.0, stock: 95 },
  { name: 'StudioWave 4K AI Conference Bar', category: 'Audio & Video', price: 999.0, cost: 490.0, stock: 88 },
  { name: 'AcousticPro ANC Executive Headset', category: 'Audio & Video', price: 379.0, cost: 165.0, stock: 260 },
  { name: 'ClearVoice USB-C Condenser Mic', category: 'Audio & Video', price: 169.0, cost: 68.0, stock: 305 },
  { name: 'Boardroom Speakerphone Array', category: 'Audio & Video', price: 489.0, cost: 225.0, stock: 112 },
  { name: 'ComputeNode Mini AI Edge Server', category: 'Cloud Hardware', price: 2499.0, cost: 1420.0, stock: 38 },
  { name: 'VaultNAS 8-Bay NVMe Storage Array', category: 'Cloud Hardware', price: 1849.0, cost: 1030.0, stock: 45 },
  { name: 'RackUPS 3000VA Smart Battery', category: 'Cloud Hardware', price: 1149.0, cost: 640.0, stock: 54 },
  { name: 'PCIe Gen5 Enterprise SSD 4TB', category: 'Cloud Hardware', price: 599.0, cost: 315.0, stock: 190 },
  { name: 'BioKey FIDO2 Hardware Security Key', category: 'Security Devices', price: 89.0, cost: 31.0, stock: 680 },
  { name: 'Sentinel Smart Access Reader', category: 'Security Devices', price: 429.0, cost: 198.0, stock: 120 },
  { name: 'VaultCam 4K PoE Dome Camera', category: 'Security Devices', price: 319.0, cost: 148.0, stock: 175 },
  { name: 'PrivacyGlass 32" Magnetic Filter', category: 'Security Devices', price: 129.0, cost: 46.0, stock: 290 },
  { name: 'LumenBar Adaptive Desk Light', category: 'Smart Office', price: 149.0, cost: 58.0, stock: 340 },
  { name: 'AirSense Pro CO2 & Air Monitor', category: 'Smart Office', price: 239.0, cost: 102.0, stock: 215 },
  { name: 'RoomBook 10" PoE Meeting Display', category: 'Smart Office', price: 449.0, cost: 210.0, stock: 130 },
  { name: 'PowerRail Smart Desk PDU', category: 'Smart Office', price: 179.0, cost: 74.0, stock: 275 },
];

const REGION_CITIES: Array<{ region: string; cities: string[]; weight: number }> = [
  { region: 'North America', cities: ['San Francisco', 'New York', 'Austin', 'Seattle', 'Toronto', 'Chicago', 'Boston'], weight: 0.34 },
  { region: 'Europe', cities: ['London', 'Berlin', 'Amsterdam', 'Paris', 'Zurich', 'Dublin', 'Stockholm'], weight: 0.28 },
  { region: 'Asia Pacific', cities: ['Singapore', 'Tokyo', 'Sydney', 'Bengaluru', 'Seoul', 'Melbourne'], weight: 0.22 },
  { region: 'Latin America', cities: ['Sao Paulo', 'Mexico City', 'Bogota', 'Santiago'], weight: 0.10 },
  { region: 'Middle East & Africa', cities: ['Dubai', 'Riyadh', 'Cape Town'], weight: 0.06 },
];

const COMPANY_PREFIXES = [
  'Northstar', 'Meridian', 'Vanguard', 'Apex', 'Cobalt', 'Stratos', 'Helios', 'Kestrel',
  'Veridian', 'Summit', 'Atlas', 'Orion', 'Cascadia', 'Redwood', 'Solstice', 'Harbor',
  'Keystone', 'Alder', 'Beacon', 'Crestview', 'Silverline', 'Borealis', 'Ironclad', 'Pacific',
  'Nordic', 'Sterling', 'Aurelia', 'Granite', 'Polaris', 'Evergreen',
];

const COMPANY_SUFFIXES = [
  'Systems', 'Labs', 'Logistics', 'Health', 'Financial', 'Technologies', 'Industries',
  'Partners', 'Holdings', 'Retail Group', 'Cloud', 'Ventures', 'Analytics', 'Bio', 'Media',
];

async function initializeSchemaAndSeed(pg: PGlite): Promise<void> {
  await pg.exec(DDL_SQL);

  // Seed default demo analyst user if none exists
  const userCheck = await pg.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM app_users');
  if (Number(userCheck.rows[0]?.count ?? 0) === 0) {
    const demoHash = bcrypt.hashSync('DemoPass123!', 10);
    const userInsert = await pg.query<{ id: number }>(
      `INSERT INTO app_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      ['Elena Vance', 'demo@intellibi.ai', demoHash, 'Lead Data Analyst']
    );
    let demoUserId = userInsert.rows[0]?.id;
    if (!demoUserId) {
      const existingDemo = await pg.query<{ id: number }>(
        'SELECT id FROM app_users WHERE email = $1 LIMIT 1',
        ['demo@intellibi.ai']
      );
      demoUserId = existingDemo.rows[0]?.id;
    }
    if (demoUserId) {
      await pg.query(
        `INSERT INTO app_settings (user_id, max_rows, query_timeout_ms)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO NOTHING`,
        [demoUserId, config.defaultMaxQueryRows, config.defaultQueryTimeoutMs]
      );
    }
  }

  // Seed analytics dataset only if empty
  const customerCheck = await pg.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM customers');
  if (Number(customerCheck.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const rand = createSeededRandom(20261120);

  // 1. Insert 24 products
  for (const p of SEED_PRODUCTS) {
    await pg.query(
      `INSERT INTO products (product_name, category, price, cost, stock_quantity)
       VALUES ($1, $2, $3, $4, $5)`,
      [p.name, p.category, p.price, p.cost, p.stock]
    );
  }

  // 2. Insert 60 realistic enterprise customers across regions & acquisition months (2024-06 to 2026-11)
  const customerCount = 60;
  const regionCustomerBuckets: string[] = [];
  for (const rc of REGION_CITIES) {
    const count = Math.round(rc.weight * customerCount);
    for (let i = 0; i < count; i++) {
      regionCustomerBuckets.push(rc.region);
    }
  }
  while (regionCustomerBuckets.length < customerCount) {
    regionCustomerBuckets.push('North America');
  }

  for (let i = 0; i < customerCount; i++) {
    const region = regionCustomerBuckets[i];
    const rc = REGION_CITIES.find((r) => r.region === region) ?? REGION_CITIES[0];
    const city = rc.cities[i % rc.cities.length];
    const prefix = COMPANY_PREFIXES[i % COMPANY_PREFIXES.length];
    const suffix = COMPANY_SUFFIXES[Math.floor(i / 2) % COMPANY_SUFFIXES.length];
    const name = i >= 30 ? `${prefix} ${suffix} Intl` : `${prefix} ${suffix}`;
    const slug = `${prefix.toLowerCase()}-${suffix.toLowerCase().replace(/\s+/g, '')}-${i + 1}`;
    const email = `procurement@${slug}.example.com`;

    // Spread acquisition dates from Jan 2024 to Nov 2026, with North America & Europe strong recently
    const monthsAgo = Math.floor(rand() * 30);
    const createdDate = new Date(Date.UTC(2026, 10 - monthsAgo, 1 + Math.floor(rand() * 26)));
    const createdStr = createdDate.toISOString().slice(0, 19).replace('T', ' ');

    await pg.query(
      `INSERT INTO customers (customer_name, email, city, region, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, city, region, createdStr]
    );
  }

  // 3. Insert 360 realistic orders across 24 months (Dec 2024 through Nov 2026)
  // Customers 1..8 intentionally exhibit purchase decline (heavy orders in 2025, very few/small in 2026)
  // so analytical questions about "customers whose purchases have declined" yield crisp, genuine insights!
  const paymentMethods = ['Corporate Invoice', 'Credit Card', 'Wire Transfer', 'ACH', 'PayPal'];
  const orderDateSlots: Array<{ year: number; month: number; count: number }> = [];

  // 24 months from Dec 2024 to Nov 2026 with realistic seasonal & upward B2B growth trajectory
  const monthlyTargets = [
    { y: 2024, m: 12, c: 12 },
    { y: 2025, m: 1, c: 11 },
    { y: 2025, m: 2, c: 12 },
    { y: 2025, m: 3, c: 14 },
    { y: 2025, m: 4, c: 13 },
    { y: 2025, m: 5, c: 15 },
    { y: 2025, m: 6, c: 16 },
    { y: 2025, m: 7, c: 14 },
    { y: 2025, m: 8, c: 15 },
    { y: 2025, m: 9, c: 17 },
    { y: 2025, m: 10, c: 16 },
    { y: 2025, m: 11, c: 19 },
    { y: 2025, m: 12, c: 21 },
    { y: 2026, m: 1, c: 14 },
    { y: 2026, m: 2, c: 15 },
    { y: 2026, m: 3, c: 17 },
    { y: 2026, m: 4, c: 16 },
    { y: 2026, m: 5, c: 18 },
    { y: 2026, m: 6, c: 19 },
    { y: 2026, m: 7, c: 18 },
    { y: 2026, m: 8, c: 20 },
    { y: 2026, m: 9, c: 22 },
    { y: 2026, m: 10, c: 23 },
    { y: 2026, m: 11, c: 21 }, // Current month (Nov 2026 up to Nov 20)
  ];

  for (const slot of monthlyTargets) {
    orderDateSlots.push({ year: slot.y, month: slot.m, count: slot.c });
  }

  for (const slot of orderDateSlots) {
    const maxDay = slot.year === 2026 && slot.month === 11 ? 20 : 28;
    for (let k = 0; k < slot.count; k++) {
      let customerId: number;
      if (slot.year === 2025 && rand() < 0.28) {
        // Declining cohort: heavy purchases in 2025
        customerId = 1 + Math.floor(rand() * 8);
      } else if (slot.year === 2026 && rand() < 0.04) {
        // Much fewer orders in 2026 for customers 1..8
        customerId = 1 + Math.floor(rand() * 8);
      } else {
        customerId = 9 + Math.floor(rand() * (customerCount - 8));
      }

      const day = 1 + Math.floor(rand() * maxDay);
      const orderDate = `${slot.year}-${String(slot.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const statusRoll = rand();
      const orderStatus =
        statusRoll < 0.80
          ? 'Completed'
          : statusRoll < 0.90
            ? 'Shipped'
            : statusRoll < 0.95
              ? 'Processing'
              : 'Cancelled';

      // Build 1 to 4 distinct products per order, weighting flagship items slightly higher
      const itemCount = 1 + Math.floor(rand() * 3);
      const chosenIndices = new Set<number>();
      while (chosenIndices.size < itemCount) {
        const bias = rand();
        let prodIdx: number;
        if (bias < 0.35) {
          // Flagship high-demand SKUs
          const topSkus = [1, 8, 12, 13, 4, 0];
          prodIdx = topSkus[Math.floor(rand() * topSkus.length)];
        } else {
          prodIdx = Math.floor(rand() * SEED_PRODUCTS.length);
        }
        chosenIndices.add(prodIdx);
      }

      let orderTotal = 0;
      const lineItems: Array<{ productId: number; qty: number; unitPrice: number }> = [];
      for (const idx of chosenIndices) {
        const prod = SEED_PRODUCTS[idx];
        const qty =
          customerId <= 8 && slot.year === 2025
            ? 2 + Math.floor(rand() * 4)
            : 1 + Math.floor(rand() * 3);
        const unitPrice = prod.price;
        orderTotal += qty * unitPrice;
        lineItems.push({ productId: idx + 1, qty, unitPrice });
      }
      orderTotal = Math.round(orderTotal * 100) / 100;

      const orderRes = await pg.query<{ order_id: number }>(
        `INSERT INTO orders (customer_id, order_date, order_status, total_amount)
         VALUES ($1, $2, $3, $4)
         RETURNING order_id`,
        [customerId, orderDate, orderStatus, orderTotal]
      );
      const orderId = orderRes.rows[0].order_id;

      for (const li of lineItems) {
        await pg.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [orderId, li.productId, li.qty, li.unitPrice]
        );
      }

      const paymentMethod = paymentMethods[Math.floor(rand() * paymentMethods.length)];
      const paymentStatus =
        orderStatus === 'Cancelled'
          ? 'Refunded'
          : orderStatus === 'Processing'
            ? 'Pending'
            : 'Completed';

      await pg.query(
        `INSERT INTO payments (order_id, payment_method, payment_status, amount)
         VALUES ($1, $2, $3, $4)`,
        [orderId, paymentMethod, paymentStatus, orderTotal]
      );
    }
  }

  // Seed 3 initial realistic query history entries for the demo analyst so History & Recent Queries look populated immediately
  const demoUserRes = await pg.query<{ id: number }>(
    'SELECT id FROM app_users WHERE email = $1',
    ['demo@intellibi.ai']
  );
  const demoUserId = demoUserRes.rows[0]?.id;
  if (demoUserId) {
    const sampleHistories = [
      {
        question: 'Which products generated the highest revenue?',
        sql: `SELECT p.product_name, p.category, SUM(oi.quantity * oi.unit_price)::numeric(12,2) AS total_revenue, SUM(oi.quantity) AS units_sold\nFROM order_items oi\nJOIN products p ON oi.product_id = p.product_id\nJOIN orders o ON oi.order_id = o.order_id\nWHERE o.order_status <> 'Cancelled'\nGROUP BY p.product_name, p.category\nORDER BY total_revenue DESC\nLIMIT 8`,
        explanation: 'Aggregates completed and active order line-item revenue by product and ranks top performers.',
        summary: 'ComputeNode Mini AI Edge Server and VaultNAS 8-Bay NVMe Storage Array lead total revenue across all categories.',
        chartType: 'bar',
      },
      {
        question: 'Show monthly revenue trends for 2026.',
        sql: `SELECT TO_CHAR(DATE_TRUNC('month', order_date), 'YYYY-MM') AS month, ROUND(SUM(total_amount), 2) AS revenue, COUNT(*) AS orders\nFROM orders\nWHERE order_status <> 'Cancelled' AND order_date >= '2026-01-01'\nGROUP BY 1\nORDER BY 1 ASC\nLIMIT 24`,
        explanation: 'Computes non-cancelled monthly revenue and order counts for 2026 ordered chronologically.',
        summary: 'Monthly revenue expanded steadily through 2026, peaking in Q3 and Q4 with higher enterprise order volume.',
        chartType: 'area',
      },
      {
        question: 'Which region has the highest customer acquisition?',
        sql: `SELECT region, COUNT(*) AS customer_count\nFROM customers\nGROUP BY region\nORDER BY customer_count DESC\nLIMIT 10`,
        explanation: 'Counts total registered enterprise accounts grouped by geographic region.',
        summary: 'North America leads customer acquisition, followed by Europe and Asia Pacific.',
        chartType: 'bar',
      },
    ];

    for (let idx = 0; idx < sampleHistories.length; idx++) {
      const sh = sampleHistories[idx];
      const execResult = await executeReadOnlyAnalyticsQuery(pg, sh.sql, 5000);
      const vizConfig = selectVisualization(sh.question, execResult.columns, execResult.rows);
      await pg.query(
        `INSERT INTO app_query_history (
           user_id, conversation_id, question, generated_sql, sql_explanation,
           validation_status, execution_status, execution_time_ms, row_count, retry_count,
           result_summary, result_payload, visualization_config, insights_payload, pipeline_trace
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          demoUserId,
          `seed-conv-${idx + 1}`,
          sh.question,
          sh.sql,
          sh.explanation,
          'passed',
          'succeeded',
          execResult.executionTimeMs,
          execResult.rows.length,
          0,
          sh.summary,
          JSON.stringify({ columns: execResult.columns, rows: execResult.rows }),
          JSON.stringify(vizConfig),
          JSON.stringify([sh.summary]),
          JSON.stringify([
            { node: 'query_analyzer', label: 'Query Analyzer', status: 'completed', durationMs: 112 },
            { node: 'schema_intelligence', label: 'Schema Intelligence', status: 'completed', durationMs: 28 },
            { node: 'sql_generation', label: 'SQL Generation', status: 'completed', durationMs: 265 },
            { node: 'sql_validation', label: 'SQL Validation', status: 'completed', durationMs: 4 },
            { node: 'sql_execution', label: 'SQL Execution', status: 'completed', durationMs: execResult.executionTimeMs },
            { node: 'data_analysis', label: 'Data Analysis', status: 'completed', durationMs: 140 },
            { node: 'visualization', label: 'Visualization', status: 'completed', durationMs: 6 },
            { node: 'response_generation', label: 'Response Generation', status: 'completed', durationMs: 195 },
          ]),
        ]
      );
    }

    // Seed 1 executive saved report
    const firstHist = await pg.query<{ id: number; result_payload: unknown; visualization_config: unknown }>(
      'SELECT id, result_payload, visualization_config FROM app_query_history WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
      [demoUserId]
    );
    if (firstHist.rows[0]) {
      await pg.query(
        `INSERT INTO app_reports (
           user_id, query_history_id, title, description, question, generated_sql,
           summary, insights_payload, visualization_config, result_payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          demoUserId,
          firstHist.rows[0].id,
          'Top Revenue-Generating Product Lines',
          'Executive breakdown of highest-grossing hardware and enterprise products from live PostgreSQL order line items.',
          sampleHistories[0].question,
          sampleHistories[0].sql,
          sampleHistories[0].summary,
          JSON.stringify([
            sampleHistories[0].summary,
            'Cloud Hardware and Workstation Gear drive the majority of high-ticket order value.',
            'All figures exclude cancelled orders to reflect net realized sales.',
          ]),
          JSON.stringify(firstHist.rows[0].visualization_config),
          JSON.stringify(firstHist.rows[0].result_payload),
        ]
      );
    }
  }
}

export interface SafeSqlExecutionResult {
  columns: string[];
  rows: Record<string, unknown>[];
  executionTimeMs: number;
  truncated: boolean;
}

function normalizeRowValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    // Convert numeric PostgreSQL strings (NUMERIC / COUNT) to numbers when clean
    if (/^-?\d+(\.\d+)?$/.test(value) && value.length < 16) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return value;
}

/**
 * Executes a validated SQL query inside a strict READ ONLY PostgreSQL transaction
 * with statement_timeout protection and guaranteed ROLLBACK so no write can ever commit.
 */
export async function executeReadOnlyAnalyticsQuery(
  pg: PGlite,
  sql: string,
  timeoutMs: number = config.defaultQueryTimeoutMs,
  maxRows: number = config.defaultMaxQueryRows
): Promise<SafeSqlExecutionResult> {
  const start = Date.now();
  const safeTimeout = Math.min(
    Math.max(Math.floor(Number.isFinite(timeoutMs) ? timeoutMs : config.defaultQueryTimeoutMs), 500),
    30000
  );
  const safeMaxRows = Math.min(
    Math.max(Math.floor(Number.isFinite(maxRows) ? maxRows : config.defaultMaxQueryRows), 1),
    1000
  );

    // Use pg.transaction() so PGlite acquires its internal _transactionMutex,
    // preventing concurrent queries/writes from interleaving inside the READ ONLY transaction.
    return pg.transaction(async (tx) => {
      await tx.exec('SET TRANSACTION READ ONLY');
      await tx.exec(`SET LOCAL statement_timeout = '${safeTimeout}ms'`);
      const result = await tx.query<Record<string, unknown>>(sql);
      const executionTimeMs = Math.max(1, Date.now() - start);
      const columns = result.fields.map((f) => f.name);
      const truncated = result.rows.length > safeMaxRows;
      const sliced = truncated ? result.rows.slice(0, safeMaxRows) : result.rows;
      const normalizedRows = sliced.map((row) => {
        const out: Record<string, unknown> = {};
        for (const col of columns) {
          out[col] = normalizeRowValue(row[col]);
        }
        return out;
      });
      await tx.rollback();
      return {
        columns,
        rows: normalizedRows,
        executionTimeMs,
        truncated,
      };
  });
}
