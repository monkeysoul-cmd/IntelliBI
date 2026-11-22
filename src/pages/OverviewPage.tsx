import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
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
        setRecentQueries(overviewRes.recentQueries);
        setRevenueSeries(revRes.series);
        setTopProducts(prodRes.products);
        setRegions(regRes.regions);
      })
      .catch(() => {
        if (active) setError('Unable to load live PostgreSQL dashboard analytics.');
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
          label: 'Total Revenue',
          value: formatCurrency(kpis.totalRevenue),
          delta: kpis.revenueGrowthPct,
          meta: 'vs prior year period',
          icon: DollarSign,
        },
        {
          label: 'Total Orders',
          value: formatNumber(kpis.totalOrders),
          delta: kpis.ordersGrowthPct,
          meta: 'Completed fulfillment',
          icon: ShoppingBag,
        },
        {
          label: 'Total Customers',
          value: formatNumber(kpis.totalCustomers),
          delta: null,
          meta: `${kpis.activeBuyers} active buyers · ${kpis.newCustomers2026} new`,
          icon: Users,
        },
        {
          label: 'Average Order Value',
          value: formatCurrency(kpis.avgOrderValue),
          delta: kpis.aovGrowthPct,
          meta: 'Net revenue per order',
          icon: Package,
        },
      ]
    : [];

  const totalRegionalRev = regions.reduce((sum, r) => sum + r.revenue, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
            Executive Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time business performance calculated directly from PostgreSQL
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Timeframe Switcher */}
          <div
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08]"
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
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  yearFilter === yr
                    ? 'bg-white dark:bg-[#1C212E] text-slate-950 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {yr === 'all' ? 'All Time' : yr}
              </button>
            ))}
          </div>

          <Button variant="primary" size="sm" onClick={() => navigate('/analyst')}>
            <Bot className="w-3.5 h-3.5" />
            <span>Ask AI Analyst</span>
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {/* 4-Column KPI Cards */}
      <section aria-label="Key performance indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Surface key={i} className="p-4.5 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-2.5 w-36" />
              </Surface>
            ))
          : kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <Surface key={card.label} hover className="p-4.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {card.label}
                      </span>
                      <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight">
                      {card.value}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-400 dark:text-slate-500 truncate">{card.meta}</span>
                    {card.delta !== null && (
                      <span
                        className={`inline-flex items-center gap-1 font-mono tabular-nums font-semibold shrink-0 ${
                          card.delta >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {card.delta >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {formatPercent(card.delta)}
                      </span>
                    )}
                  </div>
                </Surface>
              );
            })}
      </section>

      {/* Primary Charts Strip: Revenue Trend + Monthly Order Volume */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Surface className="xl:col-span-7 p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
                Revenue Trajectory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monthly realized gross revenue excluding cancellations
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/analyst?q=${encodeURIComponent('Show monthly revenue trends for the previous year.')}`
                )
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Analyze in AI</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-slate-200/80 dark:text-white/[0.06]"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className="text-slate-400 dark:text-slate-500 font-mono"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(Number(v), true)}
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className="text-slate-400 dark:text-slate-500 font-mono"
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(Number(val)), 'Revenue']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 20, 30, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#overviewRevGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-5 p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
                Monthly Orders
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Completed volume per calendar period
              </p>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSeries.slice(-12)} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-slate-200/80 dark:text-white/[0.06]"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className="text-slate-400 dark:text-slate-500 font-mono"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className="text-slate-400 dark:text-slate-500 font-mono"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val) => [formatNumber(Number(val)), 'Orders']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 20, 30, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>
      </section>

      {/* Secondary Strip: Top Products Table + Regional Distribution */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Surface className="xl:col-span-7 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
                Top Products by Revenue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ranked by line-item realized revenue
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboards')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              View catalog
            </button>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-mono text-slate-400">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 px-3 text-right font-medium">Units</th>
                    <th className="pb-2 px-3 text-right font-medium">Margin</th>
                    <th className="pb-2 pl-3 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70 dark:divide-white/[0.04] text-xs">
                  {topProducts.map((p, idx) => (
                    <tr
                      key={p.product_id}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-4.5 h-4.5 rounded text-[10px] font-mono font-semibold flex items-center justify-center bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {p.product_name}
                            </p>
                            <span className="text-[10px] text-slate-400 font-sans">
                              {p.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {formatNumber(p.units_sold)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                        {p.margin_pct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-5 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
              Regional Sales Distribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Revenue proportion, customer base, and average ticket size
            </p>
          </div>

          {loading ? (
            <div className="space-y-3.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {regions.map((r) => {
                const share = (r.revenue / totalRegionalRev) * 100;
                return (
                  <div key={r.region} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {r.region}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(r.revenue)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
                        style={{ width: `${Math.max(4, Math.min(100, share))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                      <span>{r.customers} accounts · {r.orders} orders</span>
                      <span>{share.toFixed(1)}% · AOV {formatCurrency(r.avg_order_value)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </section>

      {/* Bottom Strip: Recent Queries & Quick Prompts */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Surface className="xl:col-span-7 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
                Recent AI Analytical Inquiries
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Audit trail of natural language questions and execution metrics
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full log
            </button>
          </div>

          {recentQueries.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No queries logged yet. Launch a question in the AI Analyst to build audit history.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {recentQueries.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/analyst?historyId=${item.id}`)}
                  className="w-full py-2.5 text-left flex items-start justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] -mx-1 px-1 rounded-lg transition-colors cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {item.question}
                    </p>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5 font-mono">
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
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.rowCount} rows</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.executionTimeMs}ms</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-5 p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
              Autonomous Prompt Deck
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Instant multi-agent SQL execution prompts
            </p>
          </div>

          <div className="space-y-1.5">
            {QUICK_SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => navigate(`/analyst?q=${encodeURIComponent(q)}`)}
                className="w-full p-2.5 text-left flex items-center justify-between gap-2.5 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.06] hover:border-blue-400/60 dark:hover:border-blue-500/40 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 text-slate-700 dark:text-slate-300 transition-all cursor-pointer group"
              >
                <span className="leading-snug truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {q}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
              </button>
            ))}
          </div>
        </Surface>
      </section>
    </div>
  );
}
