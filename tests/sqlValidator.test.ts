import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndSanitizeSql } from '../src/server/agents/sqlValidator';

test('allows valid SELECT query and enforces default LIMIT cap', () => {
  const res = validateAndSanitizeSql(
    "SELECT region, COUNT(*) AS customer_count FROM customers GROUP BY region ORDER BY customer_count DESC",
    100
  );
  assert.equal(res.isValid, true);
  assert.equal(res.securityBlocked, false);
  assert.match(res.sanitizedSql, /LIMIT 100$/);
  assert.deepEqual(res.referencedTables, ['customers']);
});

test('allows valid SELECT with CTE and JOIN across analytics tables', () => {
  const sql = `
    WITH monthly AS (
      SELECT DATE_TRUNC('month', order_date) AS m, SUM(total_amount) AS rev
      FROM orders
      WHERE order_status <> 'Cancelled'
      GROUP BY 1
    )
    SELECT TO_CHAR(m, 'YYYY-MM') AS month, rev
    FROM monthly
    ORDER BY month ASC
    LIMIT 12
  `;
  const res = validateAndSanitizeSql(sql, 250);
  assert.equal(res.isValid, true);
  assert.equal(res.appliedRowLimit, 12);
  assert.deepEqual(res.referencedTables, ['orders']);
});

test('clamps excessive LIMIT to configured maxRows', () => {
  const res = validateAndSanitizeSql('SELECT product_name, price FROM products LIMIT 9999', 50);
  assert.equal(res.isValid, true);
  assert.equal(res.appliedRowLimit, 50);
  assert.match(res.sanitizedSql, /LIMIT 50$/);
});

test('rejects modifying DML and DDL operations', () => {
  const payloads = [
    'DELETE FROM orders WHERE order_id = 1',
    'DROP TABLE customers',
    'UPDATE products SET price = 0',
    "INSERT INTO customers (customer_name, email, city, region) VALUES ('x','x@x.com','NY','NA')",
    'TRUNCATE TABLE payments',
    'ALTER TABLE orders ADD COLUMN hacked TEXT',
  ];

  for (const sql of payloads) {
    const res = validateAndSanitizeSql(sql, 100);
    assert.equal(res.isValid, false, `Expected rejection for: ${sql}`);
    assert.equal(res.securityBlocked, true, `Expected securityBlocked=true for: ${sql}`);
  }
});

test('rejects stacked multiple statements', () => {
  const res = validateAndSanitizeSql('SELECT COUNT(*) FROM orders; DROP TABLE orders;', 100);
  assert.equal(res.isValid, false);
  assert.equal(res.securityBlocked, true);
});

test('rejects access to internal app tables and PostgreSQL system catalogs', () => {
  const restricted = [
    'SELECT email, password_hash FROM app_users LIMIT 10',
    'SELECT * FROM app_query_history LIMIT 10',
    'SELECT * FROM pg_catalog.pg_tables LIMIT 10',
    'SELECT * FROM information_schema.tables LIMIT 10',
  ];

  for (const sql of restricted) {
    const res = validateAndSanitizeSql(sql, 100);
    assert.equal(res.isValid, false, `Expected rejection for: ${sql}`);
    assert.equal(res.securityBlocked, true);
  }
});

test('rejects dangerous database functions such as pg_sleep', () => {
  const res = validateAndSanitizeSql('SELECT pg_sleep(10) FROM orders LIMIT 1', 100);
  assert.equal(res.isValid, false);
  assert.equal(res.securityBlocked, true);
});

test('rejects unknown fabricated tables', () => {
  const res = validateAndSanitizeSql('SELECT * FROM secret_payroll LIMIT 10', 100);
  assert.equal(res.isValid, false);
  assert.equal(res.securityBlocked, true);
});
