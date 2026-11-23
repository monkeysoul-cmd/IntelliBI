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
import { Download, Filter } from 'lucide-react';
import { dashboardApi } from '../services/api';
import type {
  CategoryMetricRow,
  ProductMetricRow,
  RegionMetricRow,
  RevenueSeriesPoint,
} from '../types/api';
import { Badge, Button, Skeleton, Surface } from '../components/ui/Primitives';
import { downloadCsvFile, formatCurrency, formatNumber } from '../utils/formatters';

const PALETTE = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#64748B'];
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
      `intellibi-products-${year}-${region}.csv`,
      cols,
      products as unknown as Record<string, unknown>[]
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Filter Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
            Interactive Dashboards
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Slice and filter PostgreSQL revenue, product margins, and regional distribution
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters:</span>
          </div>

          <label className="sr-only" htmlFor="dash-year">Filter by year</label>
          <select
            id="dash-year"
            value={year}
            onChange={(e) => setYear(e.target.value as 'all' | '2026' | '2025')}
            className="h-8 px-2.5 text-xs font-medium rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          <label className="sr-only" htmlFor="dash-region">Filter by region</label>
          <select
            id="dash-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-8 px-2.5 text-xs font-medium rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r === 'all' ? 'All Regions' : r}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="dash-category">Filter by category</label>
          <select
            id="dash-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 px-2.5 text-xs font-medium rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
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

      {/* Row 1: Revenue Line Curve + Category Share Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Surface className="xl:col-span-8 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
              Revenue Trajectory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filtered by {year === 'all' ? 'all periods' : year} · {region === 'all' ? 'all regions' : region} · {category === 'all' ? 'all categories' : category}
            </p>
          </div>

          {loading ? (
            <Skeleton className="h-[270px] w-full" />
          ) : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
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
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#3B82F6' }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        <Surface className="xl:col-span-4 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
              Category Revenue Mix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Proportional distribution by line
            </p>
          </div>

          {loading ? (
            <Skeleton className="h-[270px] w-full" />
          ) : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="revenue"
                    nameKey="category"
                    cx="50%"
                    cy="45%"
                    innerRadius={54}
                    outerRadius={86}
                    paddingAngle={3}
                  >
                    {categoryBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} stroke="transparent" />
                    ))}
                  </Pie>
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
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>
      </div>

      {/* Row 2: Regional Bar Comparison */}
      <Surface className="p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
            Regional Revenue vs. Average Order Value
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Comparative performance across global operational regions
          </p>
        </div>

        {loading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionsData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-slate-200/80 dark:text-white/[0.06]"
                  vertical={false}
                />
                <XAxis
                  dataKey="region"
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
                  formatter={(val, name) => [
                    formatCurrency(Number(val)),
                    name === 'revenue' ? 'Total Revenue' : 'Avg Order Value',
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 20, 30, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Total Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Bar dataKey="avg_order_value" name="Avg Order Value" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Surface>

      {/* Row 3: Product Profitability & Inventory Ledger */}
      <Surface className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
              Product Profitability & Stock Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {products.length} products matching active dimension criteria
            </p>
          </div>
          <Button size="xs" variant="secondary" onClick={handleExportProducts} disabled={products.length === 0}>
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-mono text-slate-400">
                <th className="py-2 pr-4 font-medium">Product</th>
                <th className="py-2 px-3 font-medium">Category</th>
                <th className="py-2 px-3 text-right font-medium">Unit Price</th>
                <th className="py-2 px-3 text-right font-medium">Units Sold</th>
                <th className="py-2 px-3 text-right font-medium">Revenue</th>
                <th className="py-2 px-3 text-right font-medium">Gross Profit</th>
                <th className="py-2 px-3 text-right font-medium">Margin</th>
                <th className="py-2 pl-3 text-right font-medium">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 dark:divide-white/[0.04] text-xs">
              {products.map((p) => (
                <tr key={p.product_id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {p.product_name}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <Badge variant="neutral">{p.category}</Badge>
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
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
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
