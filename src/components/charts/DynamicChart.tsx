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
import {
  AreaChart as AreaIcon,
  BarChart3,
  Download,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Search,
  Table2,
} from 'lucide-react';
import type { ChartType, VisualizationConfig } from '../../types/api';
import {
  downloadCsvFile,
  formatCellValue,
  formatColumnHeader,
  formatCurrency,
  formatNumber,
} from '../../utils/formatters';
import { cn } from '../../utils/cn';

const SERIES_COLORS = [
  '#3B82F6', // Electric Sapphire
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EC4899', // Rose
  '#06B6D4', // Cyan
  '#64748B', // Slate
];

interface DynamicChartProps {
  config: VisualizationConfig;
  columns: string[];
  rows: Record<string, unknown>[];
  height?: number;
}

export function DynamicChart({ config, columns, rows, height = 310 }: DynamicChartProps) {
  const [activeView, setActiveView] = useState<ChartType>(config.chartType);
  const [tableFilter, setTableFilter] = useState('');

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
      normalized.__shortLabel = rawLabel.length > 20 ? `${rawLabel.slice(0, 18)}…` : rawLabel;
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

  const renderViewIcon = (type: ChartType) => {
    switch (type) {
      case 'area':
        return <AreaIcon className="w-3.5 h-3.5" />;
      case 'bar':
        return <BarChart3 className="w-3.5 h-3.5" />;
      case 'line':
        return <LineIcon className="w-3.5 h-3.5" />;
      case 'pie':
        return <PieIcon className="w-3.5 h-3.5" />;
      case 'table':
        return <Table2 className="w-3.5 h-3.5" />;
      default:
        return <BarChart3 className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-white/[0.06]">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            {config.title || 'Analytics Visualization'}
          </h3>
          {config.subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {config.subtitle}
            </p>
          )}
        </div>

        {/* View Switcher Tabs */}
        {availableViews.length > 1 && (
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/[0.08]">
            {availableViews.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveView(v)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer',
                  activeView === v
                    ? 'bg-white dark:bg-[#1C212E] text-slate-950 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                {renderViewIcon(v)}
                <span className="capitalize">{v}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Render Chart Body */}
      {activeView === 'table' ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="Filter table rows..."
                className="w-full h-7.5 pl-8 pr-3 text-xs rounded-md bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                {filteredTableRows.length} rows
              </span>
              <button
                type="button"
                onClick={() => downloadCsvFile('analytics-data.csv', columns, rows)}
                className="inline-flex items-center gap-1 h-7.5 px-2.5 text-xs font-medium rounded-md border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200/80 dark:border-white/[0.07] rounded-lg overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-300 border-b border-slate-200/80 dark:border-white/[0.07] sticky top-0 z-10">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 font-semibold font-mono tracking-tight whitespace-nowrap"
                    >
                      {formatColumnHeader(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredTableRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className={cn(
                          'px-3 py-1.5 whitespace-nowrap text-slate-800 dark:text-slate-200',
                          typeof row[col] === 'number' && 'font-mono tabular-nums'
                        )}
                      >
                        {formatCellValue(col, row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ height }} className="w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            {activeView === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  {config.yKeys.map((key, i) => {
                    const color = SERIES_COLORS[i % SERIES_COLORS.length];
                    return (
                      <linearGradient key={key} id={`areaGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-white/[0.06]"
                />
                <XAxis
                  dataKey="__shortLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-400 dark:text-slate-500 font-mono"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxisTick}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-400 dark:text-slate-500 font-mono"
                />
                <Tooltip
                  formatter={formatTooltipVal}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 20, 30, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                />
                {config.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
                {config.yKeys.map((key, i) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={formatColumnHeader(key)}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#areaGrad-${i})`}
                  />
                ))}
              </AreaChart>
            ) : activeView === 'line' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-white/[0.06]"
                />
                <XAxis
                  dataKey="__shortLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-400 dark:text-slate-500 font-mono"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxisTick}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-400 dark:text-slate-500 font-mono"
                />
                <Tooltip
                  formatter={formatTooltipVal}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 20, 30, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                />
                {config.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
                {config.yKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={formatColumnHeader(key)}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            ) : activeView === 'pie' ? (
              <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <Tooltip
                  formatter={formatTooltipVal}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 20, 30, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Pie
                  data={chartData}
                  dataKey={config.yKeys[0] || 'value'}
                  nameKey={config.xKey || 'name'}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-white/[0.06]"
                />
                <XAxis
                  dataKey="__shortLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-400 dark:text-slate-500 font-mono"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxisTick}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-400 dark:text-slate-500 font-mono"
                />
                <Tooltip
                  formatter={formatTooltipVal}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 20, 30, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                />
                {config.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
                {config.yKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={formatColumnHeader(key)}
                    fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
