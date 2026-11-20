import type { ChartType, QueryAnalysisResult, VisualizationConfig } from './types.ts';

const TIME_COLUMN_REGEX =
  /(date|month|year|quarter|week|day|period|time|created_at|order_date)/i;

const CURRENCY_COLUMN_REGEX =
  /(revenue|amount|sales|price|cost|profit|margin|aov|value|spend|total_spend|avg_order|average_order|gross|net_sales)/i;

const PERCENT_COLUMN_REGEX = /(pct|percent|rate|ratio|share|growth|decline_pct|margin_pct)/i;

const PROPORTION_QUESTION_REGEX =
  /(share|proportion|breakdown|distribution|percentage|split|composition|mix)/i;

const TREND_QUESTION_REGEX = /(trend|over time|monthly|quarterly|yearly|daily|weekly|history|progression)/i;

function isNumericColumn(rows: Record<string, unknown>[], col: string): boolean {
  let numericCount = 0;
  let nonNullCount = 0;
  for (const row of rows.slice(0, 30)) {
    const val = row[col];
    if (val === null || val === undefined || val === '') continue;
    nonNullCount++;
    if (typeof val === 'number' && Number.isFinite(val)) {
      numericCount++;
    } else if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())) {
      numericCount++;
    }
  }
  return nonNullCount > 0 && numericCount / nonNullCount >= 0.8;
}

function isTimeLikeValues(rows: Record<string, unknown>[], col: string): boolean {
  if (TIME_COLUMN_REGEX.test(col)) return true;
  const sample = rows
    .slice(0, 10)
    .map((r) => String(r[col] ?? ''))
    .filter(Boolean);
  if (sample.length === 0) return false;
  const dateLike = sample.filter((v) =>
    /^(\d{4}-\d{2}(-\d{2})?|20\d{2}\s*Q[1-4]|Q[1-4]\s*20\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+20\d{2})$/i.test(
      v.trim()
    )
  );
  return dateLike.length / sample.length >= 0.7;
}

function inferValueFormat(yKeys: string[], question: string): 'currency' | 'number' | 'percent' {
  const joined = `${yKeys.join(' ')} ${question}`;
  if (yKeys.length > 0 && yKeys.every((k) => PERCENT_COLUMN_REGEX.test(k))) {
    return 'percent';
  }
  if (yKeys.some((k) => CURRENCY_COLUMN_REGEX.test(k))) {
    return 'currency';
  }
  if (/(revenue|sales|aov|spend|price|profit|dollar|\$)/i.test(joined) && !/(count|orders|customers|units|quantity)/i.test(yKeys[0] ?? '')) {
    return 'currency';
  }
  return 'number';
}

/**
 * Node 8: Visualization Agent
 * Automatically chooses the optimal chart type & axis configuration from actual returned PostgreSQL data.
 * Pure deterministic function — thoroughly unit-testable.
 */
export function selectVisualization(
  question: string,
  columns: string[],
  rows: Record<string, unknown>[],
  analysis?: QueryAnalysisResult
): VisualizationConfig {
  const cleanTitle = question.trim().replace(/\?+$/, '');

  if (columns.length === 0 || rows.length === 0) {
    return {
      chartType: 'table',
      title: cleanTitle || 'Query Results',
      subtitle: 'No matching records returned',
      xKey: columns[0] ?? 'result',
      yKeys: [],
      valueFormat: 'number',
      allowTableToggle: false,
      alternateCharts: [],
    };
  }

  const numericCols = columns.filter(
    (c) => !/(^|_)id$/i.test(c) && isNumericColumn(rows, c)
  );
  const categoricalCols = columns.filter((c) => !numericCols.includes(c));

  // Rule 1: Single aggregate result -> KPI card
  if (rows.length === 1 && numericCols.length >= 1 && numericCols.length <= 4 && categoricalCols.length <= 1) {
    const format = inferValueFormat(numericCols, question);
    return {
      chartType: 'kpi',
      title: cleanTitle,
      subtitle: 'Single aggregate metric calculated from PostgreSQL',
      xKey: categoricalCols[0] ?? numericCols[0],
      yKeys: numericCols,
      valueFormat: format,
      allowTableToggle: true,
      alternateCharts: ['table'],
    };
  }

  // Rule 2: No numeric columns or very wide / very large dataset -> Searchable Table
  if (numericCols.length === 0 || columns.length > 6 || rows.length > 35) {
    return {
      chartType: 'table',
      title: cleanTitle,
      subtitle: `${rows.length} rows · ${columns.length} columns`,
      xKey: categoricalCols[0] ?? columns[0],
      yKeys: numericCols.slice(0, 3),
      valueFormat: inferValueFormat(numericCols, question),
      allowTableToggle: false,
      alternateCharts: numericCols.length > 0 && rows.length <= 50 ? ['bar'] : [],
    };
  }

  const xKey = categoricalCols[0] ?? columns[0];
  // Prioritize primary revenue/amount/count metrics (max 2 plotted series so charts stay crisp)
  const yKeys = numericCols.slice(0, 2);
  const valueFormat = inferValueFormat(yKeys, question);

  // Rule 3: Time-series data -> Area or Line chart
  const isTimeSeries = isTimeLikeValues(rows, xKey) || (TREND_QUESTION_REGEX.test(question) && rows.length >= 3);
  if (isTimeSeries && rows.length >= 2) {
    const preferLine = analysis?.preferredChartHint === 'line' || yKeys.length > 1;
    const chartType: ChartType = preferLine ? 'line' : 'area';
    return {
      chartType,
      title: cleanTitle,
      subtitle: `Time series across ${rows.length} periods`,
      xKey,
      yKeys,
      valueFormat,
      allowTableToggle: true,
      alternateCharts: chartType === 'area' ? ['line', 'bar', 'table'] : ['area', 'bar', 'table'],
    };
  }

  // Rule 4: Proportional / breakdown data with <= 7 non-negative slices -> Pie/Donut
  const allPositive = rows.every((r) => Number(r[yKeys[0]] ?? 0) >= 0);
  if (
    allPositive &&
    rows.length >= 2 &&
    rows.length <= 7 &&
    yKeys.length === 1 &&
    (PROPORTION_QUESTION_REGEX.test(question) || analysis?.preferredChartHint === 'pie')
  ) {
    return {
      chartType: 'pie',
      title: cleanTitle,
      subtitle: `Distribution across ${rows.length} segments`,
      xKey,
      yKeys: [yKeys[0]],
      valueFormat,
      allowTableToggle: true,
      alternateCharts: ['bar', 'table'],
    };
  }

  // Rule 5: Category comparison -> Bar chart
  return {
    chartType: 'bar',
    title: cleanTitle,
    subtitle: `Comparison across ${rows.length} ${xKey.replace(/_/g, ' ')} groups`,
    xKey,
    yKeys,
    valueFormat,
    allowTableToggle: true,
    alternateCharts:
      rows.length <= 7 && allPositive && yKeys.length === 1
        ? ['pie', 'line', 'table']
        : ['line', 'table'],
  };
}
