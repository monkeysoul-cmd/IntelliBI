import type { ComputedColumnStats, DataAnalysisResult } from './types.ts';

function toNumeric(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())) {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatMetricVal(col: string, val: number): string {
  const lower = col.toLowerCase();
  if (/(revenue|amount|sales|price|cost|profit|aov|spend|value|gross)/i.test(lower)) {
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (/(pct|percent|rate|share|growth|margin_pct)/i.test(lower)) {
    return `${val.toFixed(1)}%`;
  }
  return Number.isInteger(val)
    ? val.toLocaleString('en-US')
    : val.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Pure deterministic statistical analyzer over real PostgreSQL query results.
 * Guarantees that every statistic, trend delta, top/bottom leader, and anomaly
 * is mathematically derived from actual rows — never hallucinated.
 */
export function computeStatisticalAnalysis(
  columns: string[],
  rows: Record<string, unknown>[]
): DataAnalysisResult {
  if (rows.length === 0 || columns.length === 0) {
    return {
      rowCount: 0,
      columnStats: [],
      insights: ['The query executed cleanly but returned zero matching rows for the selected criteria.'],
      anomalies: [],
    };
  }

  const labelCol =
    columns.find((c) => !rows.every((r) => toNumeric(r[c]) !== null)) ?? columns[0];

  const columnStats: ComputedColumnStats[] = [];
  const insights: string[] = [];
  const anomalies: string[] = [];

  for (const col of columns) {
    if (/(^|_)id$/i.test(col)) continue;

    const paired: Array<{ label: string; value: number }> = [];
    for (const row of rows) {
      const n = toNumeric(row[col]);
      if (n !== null) {
        paired.push({ label: String(row[labelCol] ?? ''), value: n });
      }
    }

    if (paired.length === 0 || paired.length < rows.length * 0.7) continue;

    const values = paired.map((p) => p.value);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / values.length;
    const sorted = [...paired].sort((a, b) => b.value - a.value);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];

    // Sequential trend check if the label column looks chronological (YYYY-MM, YYYY-Q#, dates)
    let trendDeltaPct: number | null = null;
    if (
      paired.length >= 2 &&
      /(date|month|quarter|year|week|period)/i.test(labelCol)
    ) {
      const first = paired[0].value;
      const last = paired[paired.length - 1].value;
      if (Math.abs(first) > 0.0001) {
        trendDeltaPct = Number((((last - first) / Math.abs(first)) * 100).toFixed(1));
      }
    }

    // Outlier detection using population standard deviation (z-score > 2.0 on >= 5 rows)
    if (values.length >= 5) {
      const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        for (const item of paired) {
          const z = (item.value - mean) / stdDev;
          if (Math.abs(z) >= 2.0) {
            const direction = z > 0 ? 'above' : 'below';
            anomalies.push(
              `${item.label} stands out as a statistical outlier in ${col.replace(/_/g, ' ')} (${formatMetricVal(col, item.value)}, ${Math.abs(z).toFixed(1)}σ ${direction} the average of ${formatMetricVal(col, mean)}).`
            );
          }
        }
      }
    }

    columnStats.push({
      column: col,
      count: paired.length,
      sum: Number(sum.toFixed(2)),
      mean: Number(mean.toFixed(2)),
      min: bottom.value,
      max: top.value,
      topLabel: top.label,
      topValue: top.value,
      bottomLabel: bottom.label,
      bottomValue: bottom.value,
      trendDeltaPct,
    });
  }

  // Synthesize crisp grounded insights from the primary metric(s)
  const primary = columnStats[0];
  if (primary) {
    const colLabel = primary.column.replace(/_/g, ' ');
    if (rows.length === 1) {
      insights.push(
        `Calculated ${colLabel} is ${formatMetricVal(primary.column, primary.max)}.`
      );
      if (columnStats[1]) {
        insights.push(
          `Secondary metric ${columnStats[1].column.replace(/_/g, ' ')} stands at ${formatMetricVal(columnStats[1].column, columnStats[1].max)}.`
        );
      }
    } else {
      insights.push(
        `${primary.topLabel} leads in ${colLabel} at ${formatMetricVal(primary.column, primary.topValue ?? primary.max)}, compared to a dataset average of ${formatMetricVal(primary.column, primary.mean)}.`
      );

      if (typeof primary.trendDeltaPct === 'number') {
        const verb = primary.trendDeltaPct >= 0 ? 'increased' : 'decreased';
        insights.push(
          `Across the ${rows.length} periods returned, ${colLabel} ${verb} by ${Math.abs(primary.trendDeltaPct).toFixed(1)}% from ${pairedLabel(rows, labelCol, 0)} to ${pairedLabel(rows, labelCol, rows.length - 1)}.`
        );
      } else if (primary.bottomLabel && primary.bottomLabel !== primary.topLabel && primary.sum > 0) {
        const sharePct = ((primary.max / primary.sum) * 100).toFixed(1);
        insights.push(
          `The top entry accounts for ${sharePct}% of the combined ${colLabel} (${formatMetricVal(primary.column, primary.sum)}), while ${primary.bottomLabel} is lowest at ${formatMetricVal(primary.column, primary.min)}.`
        );
      }
    }
  }

  if (anomalies.length > 0) {
    insights.push(anomalies[0]);
  }

  return {
    rowCount: rows.length,
    columnStats,
    insights,
    anomalies,
  };
}

function pairedLabel(rows: Record<string, unknown>[], col: string, index: number): string {
  return String(rows[index]?.[col] ?? `Row ${index + 1}`);
}
