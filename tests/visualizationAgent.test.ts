import test from 'node:test';
import assert from 'node:assert/strict';
import { selectVisualization } from '../src/server/agents/visualizationAgent';
import { computeStatisticalAnalysis } from '../src/server/agents/dataAnalysisAgent';

test('selects KPI card for single aggregate row', () => {
  const viz = selectVisualization(
    'What was our total revenue this month?',
    ['total_revenue', 'order_count'],
    [{ total_revenue: 84250.5, order_count: 21 }]
  );
  assert.equal(viz.chartType, 'kpi');
  assert.equal(viz.valueFormat, 'currency');
  assert.deepEqual(viz.yKeys, ['total_revenue', 'order_count']);
});

test('selects area chart for monthly revenue time series', () => {
  const viz = selectVisualization(
    'Show monthly revenue trends for 2026',
    ['month', 'revenue'],
    [
      { month: '2026-01', revenue: 41000 },
      { month: '2026-02', revenue: 46500 },
      { month: '2026-03', revenue: 52200 },
    ]
  );
  assert.equal(viz.chartType, 'area');
  assert.equal(viz.xKey, 'month');
  assert.equal(viz.valueFormat, 'currency');
});

test('selects pie chart for proportional share question with few categories', () => {
  const viz = selectVisualization(
    'Show revenue share breakdown by region',
    ['region', 'revenue'],
    [
      { region: 'North America', revenue: 120000 },
      { region: 'Europe', revenue: 95000 },
      { region: 'Asia Pacific', revenue: 72000 },
    ]
  );
  assert.equal(viz.chartType, 'pie');
  assert.equal(viz.xKey, 'region');
});

test('selects bar chart for categorical product comparison', () => {
  const viz = selectVisualization(
    'Which products generated the highest revenue?',
    ['product_name', 'total_revenue'],
    [
      { product_name: 'ComputeNode Mini', total_revenue: 98000 },
      { product_name: 'VaultNAS 8-Bay', total_revenue: 74000 },
      { product_name: 'UltraView 38', total_revenue: 61000 },
    ]
  );
  assert.equal(viz.chartType, 'bar');
  assert.equal(viz.allowTableToggle, true);
});

test('selects table for large wide tabular datasets', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    customer_name: `Account ${i}`,
    city: 'City',
    region: 'Europe',
    orders: i + 1,
    revenue: (i + 1) * 1000,
    aov: 1000,
    status: 'Active',
  }));
  const viz = selectVisualization(
    'List all customer order metrics',
    ['customer_name', 'city', 'region', 'orders', 'revenue', 'aov', 'status'],
    rows
  );
  assert.equal(viz.chartType, 'table');
});

test('computes accurate deterministic stats, trend delta, and outliers', () => {
  const analysis = computeStatisticalAnalysis(
    ['month', 'revenue'],
    [
      { month: '2026-01', revenue: 1000 },
      { month: '2026-02', revenue: 1050 },
      { month: '2026-03', revenue: 1020 },
      { month: '2026-04', revenue: 1080 },
      { month: '2026-05', revenue: 1040 },
      { month: '2026-06', revenue: 5000 },
    ]
  );
  assert.equal(analysis.rowCount, 6);
  assert.equal(analysis.columnStats[0].max, 5000);
  assert.equal(analysis.columnStats[0].min, 1000);
  assert.equal(analysis.columnStats[0].trendDeltaPct, 400);
  assert.ok(analysis.anomalies.length >= 1, 'Expected June spike to be flagged as an outlier');
});
