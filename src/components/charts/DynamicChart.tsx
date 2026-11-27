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
  Activity,
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
  '#2563eb', // Cobalt lead
  '#525252', // Graphite secondary
  '#737373', // Graphite muted
  '#a1a1a6', // Neutral silver
  '#171717', // Graphite ink
  '#d4d4d8', // Light graphite step
];

interface DynamicChartProps {
  config: VisualizationConfig;
  columns: string[];
  rows: Record<string, unknown>[];
  height?: number;
}

  export function DynamicChart({ config, columns, rows, height = 320 }: DynamicChartProps) {
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

    const safeYKeys = useMemo(() => config.yKeys || [], [config.yKeys]);
    const safeRows = useMemo(() => rows || [], [rows]);
    const safeColumns = useMemo(() => columns || [], [columns]);

    const effectiveFormat = useMemo<'currency' | 'number' | 'percent'>(() => {
      if (config.valueFormat) return config.valueFormat;
      if (safeYKeys.some((k) => /(revenue|amount|sales|price|cost|profit|aov|spend)/i.test(k))) {
        return 'currency';
      }
      if (safeYKeys.some((k) => /(pct|percent|rate|margin)/i.test(k))) {
        return 'percent';
      }
      return 'number';
    }, [config.valueFormat, safeYKeys]);

    const chartData = useMemo(() => {
      return safeRows.slice(0, 40).map((row) => {
        const normalized: Record<string, unknown> = { ...row };
        for (const yk of safeYKeys) {
          const val = row[yk];
          normalized[yk] = typeof val === 'number' ? val : Number(val ?? 0);
        }
        const rawLabel = String(row[config.xKey] ?? '');
        normalized.__shortLabel = rawLabel.length > 20 ? `${rawLabel.slice(0, 18)}…` : rawLabel;
        return normalized;
      });
    }, [safeRows, config.xKey, safeYKeys]);

    const filteredTableRows = useMemo(() => {
      const q = tableFilter.trim().toLowerCase();
      if (!q) return safeRows;
      return safeRows.filter((row) =>
        safeColumns.some((c) => String(row[c] ?? '').toLowerCase().includes(q))
      );
    }, [safeRows, safeColumns, tableFilter]);

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
      const cls = 'w-4 h-4';
      switch (type) {
        case 'kpi':
          return <Activity className={cls} strokeWidth={1.5} />;
        case 'area':
          return <AreaIcon className={cls} strokeWidth={1.5} />;
        case 'bar':
          return <BarChart3 className={cls} strokeWidth={1.5} />;
        case 'line':
          return <LineIcon className={cls} strokeWidth={1.5} />;
        case 'pie':
          return <PieIcon className={cls} strokeWidth={1.5} />;
        case 'table':
          return <Table2 className={cls} strokeWidth={1.5} />;
        default:
          return <BarChart3 className={cls} strokeWidth={1.5} />;
      }
    };

    const tooltipStyle = {
      backgroundColor: '#19191b',
      borderColor: 'rgba(237, 237, 237, 0.12)',
      borderRadius: '8px',
      color: '#ededed',
      fontSize: '12px',
      padding: '8px 12px',
    };

    return (
        <div className="space-y-4">
          {/* Chart Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
              <div>
                  <h3 className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
                    {config.title || 'Query visualization'}
                  </h3>
                  {config.subtitle && (
            <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">{config.subtitle}</p>
                  )}
              </div>

              {availableViews.length > 1 && (
                  <div className="inline-flex items-center p-1 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
                    {availableViews.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setActiveView(v)}
                        className={cn(
                          'flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer',
                          activeView === v
                              ? 'bg-white dark:bg-[#19191b] text-[#171717] dark:text-[#ededed] shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none'
                              : 'text-[#737373] dark:text-[#85858b] hover:text-[#171717] dark:hover:text-[#ededed]'
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
              {safeRows.length === 0 ? (
                <div
                  style={{ height }}
                  className="w-full flex flex-col items-center justify-center p-6 text-xs text-[#737373] dark:text-[#85858b] border border-dashed border-[#171717]/[0.12] dark:border-[#ededed]/[0.12] rounded-lg"
                >
                  No records returned by query
                </div>
              ) : activeView === 'table' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-xs">
                        <Search
                          className="w-4 h-4 text-[#737373] dark:text-[#85858b] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          strokeWidth={1.5}
                        />
                        <input
                          type="text"
                          value={tableFilter}
                          onChange={(e) => setTableFilter(e.target.value)}
                          placeholder="Filter rows"
                          className="w-full h-8 pl-8 pr-3 text-xs rounded-md bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-[#171717] dark:text-[#ededed] placeholder:text-[#737373] dark:placeholder:text-[#85858b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 transition-colors duration-150"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b]">
                            {filteredTableRows.length} rows
                          </span>
                          <button
                            type="button"
                            onClick={() => downloadCsvFile('analytics-data.csv', safeColumns, safeRows)}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-md border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] hover:bg-[#f4f4f5] dark:hover:bg-[#232325] text-[#525252] dark:text-[#a1a1a6] transition-colors duration-150 cursor-pointer"
                          >
                            <Download className="w-4 h-4" strokeWidth={1.5} />
                            <span>CSV</span>
                          </button>
                      </div>
                    </div>

                      <div className="border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] rounded-lg overflow-x-auto max-h-80">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-[#fafafa] dark:bg-[#141415] text-[#525252] dark:text-[#a1a1a6] border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] sticky top-0 z-10">
                              <tr>
                                {safeColumns.map((col) => (
                                    <th key={col} className="px-3 py-2 font-medium font-mono whitespace-nowrap">
                                      {formatColumnHeader(col)}
                                    </th>
                  ))}
                                  </tr>
              </thead>
                              <tbody className="divide-y divide-[#171717]/[0.06] dark:divide-[#ededed]/[0.06]">
                                {filteredTableRows.map((row, idx) => (
                                  <tr
                                    key={idx}
                                    className="hover:bg-[#f4f4f5]/60 dark:hover:bg-[#232325]/50 transition-colors duration-150"
                                  >
                                    {safeColumns.map((col) => (
                                      <td
                                        key={col}
                                        className={cn(
                                          'px-3 py-2 whitespace-nowrap text-[#171717] dark:text-[#ededed]',
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
                      ) : activeView === 'kpi' ? (
                      <div
                        style={{ minHeight: height }}
                        className="w-full flex flex-col items-center justify-center p-6 rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]"
                      >
                        {safeYKeys.length > 1 && chartData[0] ? (
                          <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {safeYKeys.map((yk) => (
                              <div
                                key={yk}
                                className="p-5 rounded-lg bg-white dark:bg-[#19191b] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-center"
                              >
                                  <span className="text-xs font-mono text-[#737373] dark:text-[#85858b] block mb-2">
                                    {formatColumnHeader(yk)}
                                  </span>
                                    <div className="text-2xl sm:text-3xl font-medium font-mono tabular-nums text-[#171717] dark:text-[#ededed]">
                                      {formatCellValue(yk, chartData[0][yk])}
                                    </div>
                                  </div>
              ))}
                              </div>
                            ) : (
            <>
                                <span className="text-xs font-mono text-[#737373] dark:text-[#85858b] mb-2">
                                  {safeYKeys[0] ? formatColumnHeader(safeYKeys[0]) : config.title}
                                </span>
                                  <div className="text-3xl font-medium font-mono tabular-nums text-[#171717] dark:text-[#ededed]">
                                    {chartData[0] && safeYKeys[0]
                                      ? formatCellValue(safeYKeys[0], chartData[0][safeYKeys[0]])
                                      : chartData[0] && Object.values(chartData[0])[0] !== undefined
                                        ? String(Object.values(chartData[0])[0])
                                        : '—'}
                                  </div>
                                </>
          )}
                                {config.subtitle && (
                                    <p className="text-xs text-[#737373] dark:text-[#85858b] mt-3 text-center max-w-sm">
                                      {config.subtitle}
                                    </p>
          )}
                                  </div>
                                ) : safeYKeys.length === 0 ? (
                                <div
                                  style={{ height }}
                                  className="w-full flex flex-col items-center justify-center p-6 text-xs text-[#737373] dark:text-[#85858b] border border-dashed border-[#171717]/[0.12] dark:border-[#ededed]/[0.12] rounded-lg"
                                >
                                  No numeric series available to plot. Switch to Table view to inspect rows
                                </div>
                                ) : (
                                <div style={{ height }} className="w-full relative">
                                  <ResponsiveContainer width="100%" height="100%">
                                    {activeView === 'area' ? (
                                        <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                                          <defs>
                                            {safeYKeys.map((key, i) => {
                                              const color = SERIES_COLORS[i % SERIES_COLORS.length];
                                              return (
                                                <linearGradient key={key} id={`areaGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                  <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                                                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                                                </linearGradient>
                                              );
                                            })}
                                          </defs>
                                          <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="currentColor"
                                            className="text-[#171717]/[0.08] dark:text-[#ededed]/[0.08]"
                                          />
                                          <XAxis
                                            dataKey="__shortLabel"
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fontSize: 11, fill: 'currentColor' }}
                                            className="text-[#737373] dark:text-[#85858b] font-mono"
                                          />
                                          <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={formatAxisTick}
                                            tick={{ fontSize: 11, fill: 'currentColor' }}
                                            className="text-[#737373] dark:text-[#85858b] font-mono"
                                          />
                                          <Tooltip formatter={formatTooltipVal} contentStyle={tooltipStyle} />
                                          {safeYKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
                                          {safeYKeys.map((key, i) => (
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
                                          <LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                                            <CartesianGrid
                                              strokeDasharray="3 3"
                                              vertical={false}
                                              stroke="currentColor"
                                              className="text-[#171717]/[0.08] dark:text-[#ededed]/[0.08]"
                                            />
                                            <XAxis
                                              dataKey="__shortLabel"
                                              tickLine={false}
                                              axisLine={false}
                                              tick={{ fontSize: 11, fill: 'currentColor' }}
                                              className="text-[#737373] dark:text-[#85858b] font-mono"
                                            />
                                            <YAxis
                                              tickLine={false}
                                              axisLine={false}
                                              tickFormatter={formatAxisTick}
                                              tick={{ fontSize: 11, fill: 'currentColor' }}
                                              className="text-[#737373] dark:text-[#85858b] font-mono"
                                            />
                                            <Tooltip formatter={formatTooltipVal} contentStyle={tooltipStyle} />
                                            {safeYKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
                                            {safeYKeys.map((key, i) => (
                                              <Line
                                                key={key}
                                                type="monotone"
                                                dataKey={key}
                                                name={formatColumnHeader(key)}
                                                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                                                activeDot={{ r: 4, strokeWidth: 2 }}
                                              />
                                            ))}
                                          </LineChart>
                                          ) : activeView === 'pie' ? (
                                            <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                                              <Tooltip formatter={formatTooltipVal} contentStyle={tooltipStyle} />
                                              <Legend wrapperStyle={{ fontSize: 12 }} />
                                              <Pie
                                                data={chartData}
                                                dataKey={safeYKeys[0] || 'value'}
                                                nameKey={config.xKey || 'name'}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={52}
                                                outerRadius={88}
                                                paddingAngle={2}
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
                                              <BarChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                                                <CartesianGrid
                                                  strokeDasharray="3 3"
                                                  vertical={false}
                                                  stroke="currentColor"
                                                  className="text-[#171717]/[0.08] dark:text-[#ededed]/[0.08]"
                                                />
                                                <XAxis
                                                  dataKey="__shortLabel"
                                                  tickLine={false}
                                                  axisLine={false}
                                                  tick={{ fontSize: 11, fill: 'currentColor' }}
                                                  className="text-[#737373] dark:text-[#85858b] font-mono"
                                                />
                                                <YAxis
                                                  tickLine={false}
                                                  axisLine={false}
                                                  tickFormatter={formatAxisTick}
                                                  tick={{ fontSize: 11, fill: 'currentColor' }}
                                                  className="text-[#737373] dark:text-[#85858b] font-mono"
                                                />
                                                <Tooltip formatter={formatTooltipVal} contentStyle={tooltipStyle} />
                                                {safeYKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
                                                {safeYKeys.map((key, i) => (
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
