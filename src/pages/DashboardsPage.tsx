import React, { useEffect, useState } from 'react';
import {
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
import { Download } from 'lucide-react';
import { dashboardApi } from '../services/api';
import type {
  CategoryMetricRow,
  ProductMetricRow,
  RegionMetricRow,
  RevenueSeriesPoint,
} from '../types/api';
import { Button, Skeleton, Surface } from '../components/ui/Primitives';
import { downloadCsvFile, formatCurrency, formatNumber } from '../utils/formatters';

const PALETTE = ['#2563EB', '#0D9488', '#475569', '#D97706', '#7C3AED', '#DC2626'];
const REGIONS = [
  'all',
  'North America',
  'Europe',
  'Asia Pacific',
  'Latin America',
  'Middle East & Africa',
];

export function DashboardsPage() {
  const [year, setYear] = useState<'all' | '2026' | '2025'>('all');
  const [region, setRegion] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');

  const [revenueSeries, setRevenueSeries] = useState<RevenueSeriesPoint[]>([]);
  const [products, setProducts] = useState<ProductMetricRow[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [regionsData, setRegionsData] = useState<RegionMetricRow[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryMetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      dashboardApi.getRevenue({ year, region, category }),
      dashboardApi.getProducts({ year, region, category, limit: 24 }),
      dashboardApi.getRegions({ year, category }),
    ])
      .then(([revRes, prodRes, regRes]) => {
        if (!active) return;
        setRevenueSeries(revRes.series);
        setProducts(prodRes.products);
        setCategoriesList(prodRes.categories);
        setRegionsData(regRes.regions);
        setCategoryBreakdown(regRes.categories);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, region, category]);

  const handleExportProducts = () => {
    const cols = [
      'product_name',
      'category',
      'unit_price',
      'units_sold',
      'revenue',
      'gross_profit',
      'margin_pct',
      'stock_quantity',
    ];
    downloadCsvFile(
      `intellibi-products-${year}-${region}`,
      cols,
      products as unknown as Record<string, unknown>[]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Interactive Dashboards
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Slice live PostgreSQL revenue, profitability, regional performance, and catalog inventory across dimensions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="sr-only" htmlFor="dash-year">
            Filter by year
          </label>
          <select
            id="dash-year"
            value={year}
            onChange={(e) => setYear(e.target.value as 'all' | '2026' | '2025')}
            className="h-9 px-3 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="all">All Years (2024–2026)</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          <label className="sr-only" htmlFor="dash-region">
            Filter by region
          </label>
          <select
            id="dash-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-9 px-3 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r === 'all' ? 'All Regions' : r}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="dash-category">
            Filter by category
          </label>
          <select
            id="dash-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 px-3 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="all">All Categories</option>
            {categoriesList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 1: Revenue & Orders Trajectory + Category Share Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Surface className="xl:col-span-8 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Revenue Performance Over Time
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-5">
            Filtered by {year === 'all' ? 'all periods' : year} · {region === 'all' ? 'all regions' : region} · {category === 'all' ? 'all categories' : category}
          </p>

          {loading ? (
            <Skeleton className="h-[290px] w-full" />
          ) : (
            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(Number(v), true)}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
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
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#2563EB"
                    strokeWidth={2.2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-4 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Category Revenue Mix
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            Proportional revenue across product lines
          </p>

          {loading ? (
            <Skeleton className="h-[290px] w-full" />
          ) : (
            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="revenue"
                    nameKey="category"
                    cx="50%"
                    cy="45%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {categoryBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Pie>
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
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>
      </div>

      {/* Row 2: Regional Bar Comparison */}
      <Surface className="p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Regional Revenue vs. Average Order Value
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-5">
          Comparative territory sales from live PostgreSQL order joins
        </p>

        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionsData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" vertical={false} />
                <XAxis dataKey="region" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => formatCurrency(Number(v), true)}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip
                  formatter={(val, name) => [
                    formatCurrency(Number(val)),
                    name === 'revenue' ? 'Total Revenue' : 'Avg Order Value',
                  ]}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: 8,
                    color: '#F8FAFC',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Total Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={44} />
                <Bar dataKey="avg_order_value" name="Avg Order Value" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Surface>

      {/* Row 3: Full Product Profitability & Inventory Ledger */}
      <Surface className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Product Profitability & Stock Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {products.length} products matching current filter selection
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={handleExportProducts} disabled={products.length === 0}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4">Product</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Revenue</th>
                <th className="py-2.5 px-3 text-right">Gross Profit</th>
                <th className="py-2.5 px-3 text-right">Margin</th>
                <th className="py-2.5 pl-3 text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
              {products.map((p) => (
                <tr key={p.product_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {p.product_name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {p.category}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {formatCurrency(p.unit_price)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {formatNumber(p.units_sold)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(p.revenue)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(p.gross_profit)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {p.margin_pct.toFixed(1)}%
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {formatNumber(p.stock_quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  );
}
