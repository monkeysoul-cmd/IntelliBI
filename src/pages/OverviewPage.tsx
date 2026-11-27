import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, ArrowUpRight, Bot, TrendingDown, TrendingUp } from 'lucide-react';
import { dashboardApi } from '../services/api';
import type {
  DashboardKpis,
  ProductMetricRow,
  RecentQuerySummary,
  RegionMetricRow,
  RevenueSeriesPoint,
} from '../types/api';
import { Badge, Button, Skeleton, Surface } from '../components/ui/Primitives';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
} from '../utils/formatters';

const QUICK_SUGGESTIONS = [
  'What was our total revenue this month?',
  'Which products generated the highest revenue?',
  'Compare sales between the last two quarters.',
  'Which region has the highest customer acquisition?',
  'Show monthly revenue trends for the previous year.',
  'Identify customers whose purchases have declined.',
];

export function OverviewPage() {
  const navigate = useNavigate();

  const [yearFilter, setYearFilter] = useState<'all' | '2026' | '2025'>('all');
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [recentQueries, setRecentQueries] = useState<RecentQuerySummary[]>([]);
  const [revenueSeries, setRevenueSeries] = useState<RevenueSeriesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<ProductMetricRow[]>([]);
  const [regions, setRegions] = useState<RegionMetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      dashboardApi.getOverview(),
      dashboardApi.getRevenue({ year: yearFilter }),
      dashboardApi.getProducts({ year: yearFilter, limit: 6 }),
      dashboardApi.getRegions({ year: yearFilter }),
    ])
      .then(([overviewRes, revRes, prodRes, regRes]) => {
        if (!active) return;
        setKpis(overviewRes.kpis);
        setRecentQueries(overviewRes.recentQueries ?? []);
        setRevenueSeries(revRes.series ?? []);
        setTopProducts(prodRes.products ?? []);
        setRegions(regRes.regions ?? []);
      })
      .catch(() => {
        if (active) setError('Unable to load PostgreSQL dashboard metrics.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [yearFilter]);

  const kpiCards = kpis
    ? [
      {
        label: 'Total revenue',
        value: formatCurrency(kpis.totalRevenue),
        delta: kpis.revenueGrowthPct,
        meta: 'vs prior year',
      },
      {
        label: 'Total orders',
        value: formatNumber(kpis.totalOrders),
        delta: kpis.ordersGrowthPct,
        meta: 'vs prior year',
      },
      {
        label: 'Active customers',
        value: formatNumber(kpis.totalCustomers),
        delta: null,
        meta: `${kpis.activeBuyers} buyers · ${kpis.newCustomers2026} new in 2026`,
      },
      {
        label: 'Average order value',
        value: formatCurrency(kpis.avgOrderValue),
        delta: kpis.aovGrowthPct,
        meta: 'vs prior year',
      },
    ]
    : [];

  const totalRegionalRev =
    regions.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
          <div>
              <h1 className="text-2xl sm:text-3xl font-medium text-[#171717] dark:text-[#ededed]">
                Executive overview
              </h1>
                <p className="text-sm text-[#737373] dark:text-[#85858b] mt-1">
                  Business performance calculated directly from PostgreSQL
                </p>
              </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="inline-flex items-center p-1 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]"
                    role="tablist"
                    aria-label="Overview timeframe filter"
                  >
                    {(['all', '2026', '2025'] as const).map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        role="tab"
                        aria-selected={yearFilter === yr}
                        onClick={() => setYearFilter(yr)}
                                ? 'bg-white dark:bg-[#19191b] text-[#171717] dark:text-[#ededed] shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none'
                                : 'text-[#737373] hover:text-[#171717] dark:text-[#85858b] dark:hover:text-[#ededed]'
                            }`}
              >
                {yr === 'all' ? 'All time' : yr}
              </button>
            ))}
          </div>

          <Button variant="primary" size="sm" onClick={() => navigate('/analyst')}>
            <Bot className="w-4 h-4" strokeWidth={1.5} />
            <span>Ask AI Analyst</span>
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#fef2f2] dark:bg-[#e5484d]/10 border border-[#dc2626]/20 dark:border-[#e5484d]/25 text-xs text-[#dc2626] dark:text-[#e5484d]"
        >
          {error}
        </div>
      )}

      {/* 4-Column Stat Cards — clean numbers, labels, and explicit comparison context */}
      <section aria-label="Key performance indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Surface key={i} className="p-5 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-28" />
              </Surface>
            ))
          : kpiCards.map((card) => (
              <Surface key={card.label} className="p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <span className="text-xs text-[#737373] dark:text-[#85858b] block">
                    {card.label}
                  </span>
                  <div className="text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums text-[#171717] dark:text-[#ededed]">
                    {card.value}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {card.delta !== null ? (
                    <>
                      <span
                        className = {`inline-flex items-center gap-1 font-mono tabular-nums font-medium ${card.delta >= 0
                              ? 'text-[#16a34a] dark:text-[#4cc38a]'
                              : 'text-[#dc2626] dark:text-[#e5484d]'
                          }`}
                      >
                        {card.delta >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                        )}
                        {formatPercent(card.delta)}
                      </span>
                <span className="text-[#737373] dark:text-[#85858b]">{card.meta}</span>
              </>
              ) : (
              <span className="text-[#737373] dark:text-[#85858b] font-mono tabular-nums">
                {card.meta}
              </span>
                  )}
          </div>
        </Surface>
            ))}
      </section>

            {/* Primary Visual Band: Dominant Revenue Chart + Narrower Regional Ranked List */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              <Surface className="xl:col-span-8 p-6 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                      <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                        Revenue trajectory
                      </h2>
                        <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
                          Monthly realized revenue excluding cancelled orders
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/analyst?q=${encodeURIComponent('Show monthly revenue trends for the previous year.')}`
                          )
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#2563eb] dark:text-[#3b82f6] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Inspect in Analyst</span>
                        <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                  </div>

                  {loading ? (
            <Skeleton className="h-80 w-full" />
                  ) : revenueSeries.length === 0 ? (
                    <div className="h-80 w-full flex items-center justify-center text-xs text-[#737373] dark:text-[#85858b]">
                      No revenue records for selected period
                    </div>
                  ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-[#171717]/[0.08] dark:text-[#ededed]/[0.08]"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-[#737373] dark:text-[#85858b] font-mono"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(Number(v), true)}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-[#737373] dark:text-[#85858b] font-mono"
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(Number(val)), 'Revenue']}
                    contentStyle={{
                      backgroundColor: '#19191b',
                      borderColor: 'rgba(237, 237, 237, 0.12)',
                      borderRadius: '8px',
                      color: '#ededed',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#overviewRevGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-4 p-6">
          <div className="mb-5">
            <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
              Regional revenue
            </h2>
            <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
              Share and average order value by territory
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : regions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#737373] dark:text-[#85858b]">
              No regional records available
            </div>
          ) : (
            <div className="space-y-4">
              {regions.map((r, idx) => {
                const rev = Number(r.revenue) || 0;
                const share = totalRegionalRev > 0 ? (rev / totalRegionalRev) * 100 : 0;
                return (
                  <div key={r.region} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-[#171717] dark:text-[#ededed]">
                        {r.region}
                      </span>
                      <span className="font-mono tabular-nums font-medium text-[#171717] dark:text-[#ededed]">
                        {formatCurrency(rev)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#f4f4f5] dark:bg-[#232325] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          idx === 0
                            ? 'bg-[#2563eb] dark:bg-[#3b82f6]'
                            : 'bg-[#a1a1a6] dark:bg-[#525252]'
                        }`}
                        style={{ width: `${Math.max(4, Math.min(100, share))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#85858b] font-mono tabular-nums">
                      <span>
                        {r.customers} accounts · {r.orders} orders
                      </span>
                      <span>{share.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </section>

      {/* Secondary Strip: Top Products Table + Recent Inquiries */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Surface className="xl:col-span-7 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                Top products by revenue
              </h2>
              <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
                Line-item realized sales and gross margin
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboards')}
              className="text-xs font-medium text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150"
            >
              View catalog
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-xs font-mono text-[#737373] dark:text-[#85858b]">
                    <th className="pb-2 font-normal">Product</th>
                    <th className="pb-2 px-3 text-right font-normal">Units</th>
                    <th className="pb-2 px-3 text-right font-normal">Margin</th>
                    <th className="pb-2 pl-3 text-right font-normal">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171717]/[0.06] dark:divide-[#ededed]/[0.06] text-xs">
                  {topProducts.map((p, idx) => (
                    <tr
                      key={p.product_id}
                      className="hover:bg-[#fafafa] dark:hover:bg-[#232325]/40 transition-colors duration-150"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b] shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-[#171717] dark:text-[#ededed] truncate">
                              {p.product_name}
                            </p>
                            <span className="text-xs text-[#737373] dark:text-[#85858b]">
                              {p.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#525252] dark:text-[#a1a1a6]">
                        {formatNumber(p.units_sold)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#16a34a] dark:text-[#4cc38a]">
                        {Number.isFinite(p.margin_pct) ? p.margin_pct.toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-3 pl-3 text-right font-mono tabular-nums font-medium text-[#171717] dark:text-[#ededed]">
                        {formatCurrency(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-5 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                Recent queries
              </h2>
              <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
                Audit trail and latency
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-xs font-medium text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed] whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150"
            >
              View all
            </button>
          </div>

          {recentQueries.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#737373] dark:text-[#85858b]">
              No queries logged yet
            </div>
          ) : (
            <div className="divide-y divide-[#171717]/[0.06] dark:divide-[#ededed]/[0.06]">
              {recentQueries.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/analyst?historyId=${item.id}`)}
                  className="w-full py-3 text-left flex items-start justify-between gap-3 hover:bg-[#fafafa] dark:hover:bg-[#232325]/40 -mx-2 px-2 rounded-lg transition-colors duration-150 cursor-pointer group"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-[#171717] dark:text-[#ededed] group-hover:text-[#2563eb] dark:group-hover:text-[#3b82f6] transition-colors duration-150 truncate">
                      {item.question}
                    </p>
                    <div className="text-xs text-[#737373] dark:text-[#85858b] flex flex-wrap items-center gap-2 font-mono">
                      <Badge
                        variant={
                          item.executionStatus === 'succeeded'
                            ? 'emerald'
                            : item.executionStatus === 'blocked'
                              ? 'amber'
                              : 'rose'
                        }
                        dot
                      >
                        {item.executionStatus}
                      </Badge>
                      <span className="tabular-nums">{item.rowCount} rows</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.executionTimeMs}ms</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-[#737373] dark:text-[#85858b] group-hover:text-[#171717] dark:group-hover:text-[#ededed] shrink-0 mt-0.5 transition-colors duration-150"
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
          )}
        </Surface>
      </section>

      {/* Quick Prompts */}
      <Surface className="p-6">
        <div className="mb-4">
          <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
            Suggested queries
          </h2>
          <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
            Run a preset inquiry directly in the AI Analyst
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_SUGGESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => navigate(`/analyst?q=${encodeURIComponent(q)}`)}
              className="p-3 text-left flex items-center justify-between gap-2 text-xs rounded-lg border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] bg-[#fafafa] dark:bg-[#141415] hover:border-[#171717]/[0.18] dark:hover:border-[#ededed]/[0.18] text-[#171717] dark:text-[#ededed] transition-colors duration-150 cursor-pointer group"
            >
              <span className="truncate">{q}</span>
              <ArrowUpRight
                className="w-4 h-4 text-[#737373] dark:text-[#85858b] group-hover:text-[#2563eb] dark:group-hover:text-[#3b82f6] shrink-0 transition-colors duration-150"
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
      </Surface>
    </div>
  );
}
