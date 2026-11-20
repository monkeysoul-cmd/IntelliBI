import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, Search, Table2, TrendingUp } from 'lucide-react';
import type { ChartType, VisualizationConfig } from '../../types/api';
import {
  formatCellValue,
  formatColumnHeader,
  formatCurrency,
  formatNumber,
} from '../../utils/formatters';
import { cn } from '../../utils/cn';

const SERIES_COLORS = ['#2563EB', '#0D9488', '#475569', '#D97706', '#7C3AED', '#DC2626'];

interface DynamicChartProps {
  config: VisualizationConfig;
  columns: string[];
  rows: Record<string, unknown>[];
  height?: number;
}

export function DynamicChart({ config, columns, rows, height = 310 }: DynamicChartProps) {
  const [activeView, setActiveView] = useState<ChartType>(config.chartType);
  const [tableFilter, setTableFilter] = useState('');

  // Keep active view synced when visualization config changes for a new query
  React.useEffect(() => {
    setActiveView(config.chartType);
    setTableFilter('');
  }, [config.chartType, config.title]);

  const availableViews = useMemo(() => {
    const list: ChartType[] = [config.chartType];
    for (const alt of config.alternateCharts ?? []) {
      if (!list.includes(alt)) list.push(alt);
    }
    if (config.allowTableToggle !== false && !list.includes('table')) {
      list.push('table');
    }
    return list;
  }, [config]);

  const effectiveFormat = useMemo<'currency' | 'number' | 'percent'>(() => {
    if (config.valueFormat) return config.valueFormat;
    if (config.yKeys.some((k) => /(revenue|amount|sales|price|cost|profit|aov|spend)/i.test(k))) {
      return 'currency';
    }
    if (config.yKeys.some((k) => /(pct|percent|rate|margin)/i.test(k))) {
      return 'percent';
    }
    return 'number';
  }, [config.valueFormat, config.yKeys]);

  const chartData = useMemo(() => {
    return rows.slice(0, 40).map((row) => {
      const normalized: Record<string, unknown> = { ...row };
      for (const yk of config.yKeys) {
        const val = row[yk];
        normalized[yk] = typeof val === 'number' ? val : Number(val ?? 0);
      }
      const rawLabel = String(row[config.xKey] ?? '');
      normalized.__shortLabel = rawLabel.length > 24 ? `${rawLabel.slice(0, 22)}…` : rawLabel;
      return normalized;
    });
  }, [rows, config.xKey, config.yKeys]);

  const filteredTableRows = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((c) => String(row[c] ?? '').toLowerCase().includes(q))
    );
  }, [rows, columns, tableFilter]);

  const formatAxisTick = (value: number) => {
    if (effectiveFormat === 'currency') return formatCurrency(value, true);
    if (effectiveFormat === 'percent') return `${value}%`;
    return formatNumber(value, true);
  };

  const formatTooltipVal = (value: unknown, name?: string | number): [string, string] => {
    const num = Number(value ?? 0);
    const label = formatColumnHeader(String(name ?? 'Value'));
    if (effectiveFormat === 'currency') return [formatCurrency(num), label];
    if (effectiveFormat === 'percent') return [`${num.toFixed(1)}%`, label];
    return [formatNumber(num), label];
  };

  const viewIcon = (type: ChartType) => {
    switch (type) {
      case 'area':
        return <TrendingUp className="w-3.5 h-3.5" />;
      case 'line':
        return <LineIcon className="w-3.5 h-3.5" />;
      case 'bar':
        return <BarChart3 className="w-3.5 h-3.5" />;
      case 'pie':
        return <PieIcon className="w-3.5 h-3.5" />;
      case 'table':
      default:
        return <Table2 className="w-3.5 h-3.5" />;
    }
  };

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        No matching rows returned from PostgreSQL for this query.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {config.title}
          </h4>
          {config.subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {config.subtitle}
            </p>
          )}
        </div>

        {availableViews.length > 1 && (
          <div
            className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80"
            role="tablist"
            aria-label="Visualization display mode"
          >
            {availableViews.map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={activeView === mode}
                onClick={() => setActiveView(mode)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  activeView === mode
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                )}
              >
                {viewIcon(mode)}
                <span className="capitalize">{mode === 'kpi' ? 'KPI' : mode}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI Single Aggregate View */}
      {activeView === 'kpi' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
          {config.yKeys.map((metricKey) => {
            const rawVal = Number(rows[0]?.[metricKey] ?? 0);
            return (
              <div
                key={metricKey}
                className="p-5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {formatColumnHeader(metricKey)}
                </p>
                <p className="mt-2 text-3xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight">
                  {formatCellValue(metricKey, rawVal)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Area Chart */}
      {activeView === 'area' && (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 6, bottom: 4 }}>
              <defs>
                {config.yKeys.map((yk, i) => (
                  <linearGradient key={yk} id={`grad-${i}-${yk}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" vertical={false} />
              <XAxis
                dataKey="__shortLabel"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: 'rgba(148,163,184,0.28)' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatAxisTick}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                width={68}
              />
              <Tooltip
                formatter={formatTooltipVal}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                  borderRadius: 8,
                  color: '#F8FAFC',
                  fontSize: 12,
                }}
              />
              {config.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {config.yKeys.map((yk, idx) => (
                <Area
                  key={yk}
                  type="monotone"
                  dataKey={yk}
                  name={formatColumnHeader(yk)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#grad-${idx}-${yk})`}
                  activeDot={{ r: 4 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Line Chart */}
      {activeView === 'line' && (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 6, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" vertical={false} />
              <XAxis
                dataKey="__shortLabel"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: 'rgba(148,163,184,0.28)' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatAxisTick}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                width={68}
              />
              <Tooltip
                formatter={formatTooltipVal}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                  borderRadius: 8,
                  color: '#F8FAFC',
                  fontSize: 12,
                }}
              />
              {config.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {config.yKeys.map((yk, idx) => (
                <Line
                  key={yk}
                  type="monotone"
                  dataKey={yk}
                  name={formatColumnHeader(yk)}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={2.2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bar Chart */}
      {activeView === 'bar' && (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 16, left: 6, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" vertical={false} />
              <XAxis
                dataKey="__shortLabel"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: 'rgba(148,163,184,0.28)' }}
                tickLine={false}
                interval={0}
                angle={chartData.length > 6 ? -18 : 0}
                textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                height={chartData.length > 6 ? 54 : 30}
              />
              <YAxis
                tickFormatter={formatAxisTick}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                width={68}
              />
              <Tooltip
                formatter={formatTooltipVal}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                  borderRadius: 8,
                  color: '#F8FAFC',
                  fontSize: 12,
                }}
              />
              {config.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {config.yKeys.map((yk, idx) => (
                <Bar
                  key={yk}
                  dataKey={yk}
                  name={formatColumnHeader(yk)}
                  fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pie / Donut Chart */}
      {activeView === 'pie' && config.yKeys[0] && (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey={config.yKeys[0]}
                nameKey={config.xKey}
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={106}
                paddingAngle={2}
              >
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={SERIES_COLORS[idx % SERIES_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={formatTooltipVal}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                  borderRadius: 8,
                  color: '#F8FAFC',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Searchable Data Table */}
      {activeView === 'table' && (
        <div className="space-y-3">
          {rows.length > 6 && (
            <div className="relative max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="Filter returned rows..."
                aria-label="Filter returned table rows"
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                  {columns.map((col) => {
                    const isNum = typeof rows[0]?.[col] === 'number';
                    return (
                      <th
                        key={col}
                        className={cn(
                          'py-2.5 px-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap',
                          isNum && 'text-right'
                        )}
                      >
                        {formatColumnHeader(col)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredTableRows.slice(0, 100).map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {columns.map((col) => {
                      const val = row[col];
                      const isNum = typeof val === 'number';
                      return (
                        <td
                          key={col}
                          className={cn(
                            'py-2.5 px-3.5 text-slate-700 dark:text-slate-200 whitespace-nowrap',
                            isNum && 'text-right font-mono tabular-nums'
                          )}
                        >
                          {formatCellValue(col, val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTableRows.length > 100 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing first 100 of {filteredTableRows.length} matching rows. Export CSV to download the full result set.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
