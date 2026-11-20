import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsvString,
  formatCellValue,
  formatColumnHeader,
  formatCurrency,
  formatPercent,
} from './formatters';

test('formats currency, percentages, and column headers accurately', () => {
  assert.equal(formatCurrency(125000), '$125,000');
  assert.equal(formatCurrency(84.5), '$84.50');
  assert.equal(formatCurrency(1_250_000, true), '$1.25M');
  assert.equal(formatPercent(14.26), '+14.3%');
  assert.equal(formatPercent(-3.4), '-3.4%');
  assert.equal(formatColumnHeader('avg_order_value'), 'Avg Order Value');
  assert.equal(formatCellValue('total_revenue', 4500), '$4,500');
  assert.equal(formatCellValue('margin_pct', 48.2), '48.2%');
});

test('builds RFC-4180 compliant CSV escaping commas and quotes', () => {
  const csv = buildCsvString(
    ['product_name', 'revenue'],
    [
      { product_name: 'UltraView 38" 5K, Curved', revenue: 12990 },
      { product_name: 'ProDock Hub', revenue: 3490 },
    ]
  );
  assert.equal(
    csv,
    'product_name,revenue\n"UltraView 38"" 5K, Curved",12990\nProDock Hub,3490'
  );
});
