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
import { ArrowRight, ArrowUpRight, MessageSquareText, TrendingDown, TrendingUp } from 'lucide-react';
import { dashboardApi } from '../services/api';
import type {
  DashboardKpis,
  ProductMetricRow,
  RecentQuerySummary,
  RegionMetricRow,
  RevenueSeriesPoint,
} from '../types/api';
import { useAuth } from '../context/AuthContext';
import { Button, Skeleton, Surface } from '../components/ui/Primitives';
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
  const { user } = useAuth();
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
          meta: '2026 YTD vs 2025',
        },
        {
          label: 'Total Orders',
          value: formatNumber(kpis.totalOrders),
          delta: kpis.ordersGrowthPct,
          meta: 'Non-cancelled orders',
        },
        {
          label: 'Total Customers',
          value: formatNumber(kpis.totalCustomers),
          delta: null,
          meta: `${kpis.activeBuyers} active buyers · ${kpis.newCustomers2026} joined in 2026`,
        },
        {
          label: 'Average Order Value',
          value: formatCurrency(kpis.avgOrderValue),
          delta: kpis.aovGrowthPct,
          meta: 'Net order average',
        },
      ]
    : [];

  const totalRegionalRev = regions.reduce((sum, r) => sum + r.revenue, 0) || 1;

  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Executive Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Welcome back, {user?.name?.split(' ')[0] || 'Analyst'}. Live business metrics calculated directly from PostgreSQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80"
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
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  yearFilter === yr
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {yr === 'all' ? 'All Time' : yr}
              </button>
            ))}
          </div>

          <Button variant="primary" onClick={() => navigate('/analyst')}>
            <MessageSquareText className="w-4 h-4" />
            Ask AI Analyst
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <section aria-label="Key performance indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Surface key={i} className="p-5 space-y-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-40" />
              </Surface>
            ))
          : kpiCards.map((card) => (
              <Surface key={card.label} className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {card.label}
                  </span>
                  {card.delta !== null && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-mono tabular-nums font-medium ${
                        card.delta >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {card.delta >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {formatPercent(card.delta)}
                    </span>
                  )}
                </div>

                <div className="mt-3 text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight">
                  {card.value}
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{card.meta}</p>
              </Surface>
            ))}
      </section>

      {/* Primary Charts Grid: Revenue Trend + Monthly Order Volume */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Surface className="xl:col-span-7 p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Revenue Trend
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Analyze trend
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <Skeleton className="h-[270px] w-full" />
          ) : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.28)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(Number(v), true)}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    width={62}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(Number(val)), 'Revenue']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: 8,
                      color: '#F8FAFC',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fill="url(#overviewRevGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-5 p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Monthly Order Volume
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fulfilled and active orders per month
              </p>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-[270px] w-full" />
          ) : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSeries.slice(-12)} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.28)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val) => [formatNumber(Number(val)), 'Orders']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: 8,
                      color: '#F8FAFC',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="orders" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>
      </section>

      {/* Secondary Row: Top-Selling Products + Regional Sales Comparison */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Surface className="xl:col-span-7 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Top-Selling Products
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ranked by realized line-item revenue
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboards')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              View all products
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
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="pb-2.5 pr-4">Product</th>
                    <th className="pb-2.5 px-3 text-right">Units</th>
                    <th className="pb-2.5 px-3 text-right">Margin</th>
                    <th className="pb-2.5 pl-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                  {topProducts.map((p) => (
                    <tr
                      key={p.product_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100 leading-snug">
                          {p.product_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.category}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
                        {formatNumber(p.units_sold)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
                        {p.margin_pct.toFixed(1)}%
                      </td>
                      <td className="py-3 pl-3 text-right font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
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
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Regional Sales Comparison
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Revenue share, customer count, and average order value by territory
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {regions.map((r) => {
                const share = (r.revenue / totalRegionalRev) * 100;
                return (
                  <div key={r.region} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {r.region}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(r.revenue)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                        style={{ width: `${Math.max(4, Math.min(100, share))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <span>
                        {r.customers} accounts · {r.orders} orders
                      </span>
                      <span>
                        {share.toFixed(1)}% · AOV {formatCurrency(r.avg_order_value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </section>

      {/* Bottom Row: Recent AI Activity + Suggested Business Questions */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Surface className="xl:col-span-7 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Recent Analytical Queries
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any query to reopen its SQL, visualization, and insights
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full history
            </button>
          </div>

          {recentQueries.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No queries run yet. Ask your first analytical question to build history.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {recentQueries.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/analyst?historyId=${item.id}`)}
                  className="w-full py-3 text-left flex items-start justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.question}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          item.executionStatus === 'succeeded'
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : item.executionStatus === 'blocked'
                              ? 'text-amber-700 dark:text-amber-400 font-medium'
                              : 'text-red-600 dark:text-red-400 font-medium'
                        }
                      >
                        {item.executionStatus === 'succeeded'
                          ? 'Succeeded'
                          : item.executionStatus === 'blocked'
                            ? 'Blocked'
                            : 'Needs review'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.rowCount} rows</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.executionTimeMs}ms</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-5 p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Quick Business Questions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Launch an autonomous multi-agent SQL analysis in one click
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {QUICK_SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => navigate(`/analyst?q=${encodeURIComponent(q)}`)}
                className="w-full py-2.5 text-left flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <span className="leading-snug">{q}</span>
                <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </Surface>
      </section>
    </div>
  );
}
