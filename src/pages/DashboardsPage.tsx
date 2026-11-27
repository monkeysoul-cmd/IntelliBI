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

const PALETTE = ['#2563eb', '#525252', '#737373', '#a1a1a6', '#171717', '#d4d4d8'];
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
      dashboardApi.getRegions({ year, region, category }),
    ])
      .then(([revRes, prodRes, regRes]) => {
        if (!active) return;
        setRevenueSeries(revRes.series ?? []);
        setProducts(prodRes.products ?? []);
        setCategoriesList(prodRes.categories ?? []);
        setRegionsData(regRes.regions ?? []);
        setCategoryBreakdown(regRes.categories ?? []);
      })
      .catch((err) => {
        console.error('Failed to load dashboard metrics', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, region, category]);

  const handleExportProducts = () => {
    if (!products || products.length === 0) return;
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

  const tooltipStyle = {
    backgroundColor: '#19191b',
    borderColor: 'rgba(237, 237, 237, 0.12)',
    borderRadius: '8px',
    color: '#ededed',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Filter Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
          <div>
              <h1 className="text-2xl sm:text-3xl font-medium text-[#171717] dark:text-[#ededed]">
                Interactive dashboards
              </h1>
                <p className="text-sm text-[#737373] dark:text-[#85858b] mt-1">
                  Filter PostgreSQL revenue, product margins, and regional distribution
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#737373] dark:text-[#85858b] mr-1">
                    <Filter className="w-4 h-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline">Filters</span>
                  </div>

                  <label className="sr-only" htmlFor="dash-year">
                    Filter by year
                  </label>
                  <select
                    id="dash-year"
                    value={year}
                    onChange={(e) => setYear(e.target.value as 'all' | '2026' | '2025')}
                    className="h-8 px-3 text-xs font-medium rounded-lg bg-white dark:bg-[#19191b] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-[#171717] dark:text-[#ededed] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 cursor-pointer"
                  >
                    <option value="all">All years</option>
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
                    className="h-8 px-3 text-xs font-medium rounded-lg bg-white dark:bg-[#19191b] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-[#171717] dark:text-[#ededed] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 cursor-pointer"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r === 'all' ? 'All regions' : r}
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
                    className="h-8 px-3 text-xs font-medium rounded-lg bg-white dark:bg-[#19191b] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-[#171717] dark:text-[#ededed] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 cursor-pointer"
                  >
                    <option value="all">All categories</option>
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 1: Revenue Line Curve + Category Mix */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  <Surface className="xl:col-span-8 p-6">
                    <div className="mb-4">
                        <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                          Revenue trajectory
                        </h2>
                          <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5 font-mono">
                            {year === 'all' ? 'All periods' : year} · {region === 'all' ? 'All regions' : region} ·{' '}
                            {category === 'all' ? 'All categories' : category}
                          </p>
                        </div>

                        {loading ? (
            <Skeleton className="h-80 w-full" />
                        ) : revenueSeries.length === 0 ? (
                            <div className="h-80 w-full flex items-center justify-center text-xs text-[#737373] dark:text-[#85858b]">
                              No revenue data for the selected filters
                            </div>
                            ) : (
                              <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={revenueSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
                                        contentStyle={tooltipStyle}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="revenue"
                                        name="Revenue"
                                        stroke="#2563eb"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: '#2563eb' }}
                                        activeDot={{ r: 4, strokeWidth: 2 }}
                                      />
                                    </LineChart>
                                </ResponsiveContainer>
                              </div>
          )}
                            </Surface>

                              <Surface className="xl:col-span-4 p-6">
                                <div className="mb-4">
                                    <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                                      Category mix
                                    </h2>
                                      <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
                                        Share by product line
                                      </p>
                                    </div>

                                    {loading ? (
            <Skeleton className="h-80 w-full" />
                                    ) : categoryBreakdown.length === 0 ? (
                                        <div className="h-80 w-full flex items-center justify-center text-xs text-[#737373] dark:text-[#85858b]">
                                          No category data for the selected filters
                                        </div>
                                        ) : (
                                          <div className="h-80 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                              <PieChart>
                                                <Pie
                                                  data={categoryBreakdown}
                                                  dataKey="revenue"
                                                  nameKey="category"
                                                  cx="50%"
                                                  cy="44%"
                                                  innerRadius={52}
                                                  outerRadius={84}
                                                  paddingAngle={2}
                                                >
                                                  {categoryBreakdown.map((_, idx) => (
                                                    <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} stroke="transparent" />
                                                  ))}
                                                </Pie>
                                                <Tooltip
                                                  formatter={(val) => [formatCurrency(Number(val)), 'Revenue']}
                                                  contentStyle={tooltipStyle}
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
                                        <div className="mb-4">
                                            <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                                              Regional revenue vs. average order value
                                            </h2>
                                              <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
                                                Performance across operational regions
                                              </p>
                                            </div>

                                            {loading ? (
          <Skeleton className="h-64 w-full" />
                                            ) : regionsData.length === 0 ? (
                                                <div className="h-64 w-full flex items-center justify-center text-xs text-[#737373] dark:text-[#85858b]">
                                                  No regional comparison data for the selected filters
                                                </div>
                                                ) : (
                                                  <div className="h-64 w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={regionsData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                                                          <CartesianGrid
                                                            strokeDasharray="3 3"
                                                            stroke="currentColor"
                                                            className="text-[#171717]/[0.08] dark:text-[#ededed]/[0.08]"
                                                            vertical={false}
                                                          />
                                                          <XAxis
                                                            dataKey="region"
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
                                                            formatter={(val, name) => [
                                                              formatCurrency(Number(val)),
                                                              name === 'revenue' ? 'Total revenue' : 'Avg order value',
                                                            ]}
                                                            contentStyle={tooltipStyle}
                                                          />
                                                          <Legend wrapperStyle={{ fontSize: 12 }} />
                                                          <Bar dataKey="revenue" name="Total revenue" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                                          <Bar dataKey="avg_order_value" name="Avg order value" fill="#737373" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                  </div>
        )}
                                                </Surface>

                                                {/* Row 3: Product Profitability & Inventory Ledger */}
                                                    <Surface className="p-6">
                                                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                                        <div>
                                                            <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                                                              Product profitability and stock
                                                            </h2>
                                                              <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5 font-mono tabular-nums">
                                                                {products.length} products matching criteria
                                                              </p>
                                                            </div>
                                                            <Button size="xs" variant="secondary" onClick={handleExportProducts} disabled={products.length === 0}>
                                                              <Download className="w-4 h-4" strokeWidth={1.5} />
                                                              <span>Export CSV</span>
                                                            </Button>
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                          <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-xs font-mono text-[#737373] dark:text-[#85858b]">
                                                                  <th className="py-2 pr-4 font-normal">Product</th>
                                                                  <th className="py-2 px-3 font-normal">Category</th>
                                                                  <th className="py-2 px-3 text-right font-normal">Unit price</th>
                                                                  <th className="py-2 px-3 text-right font-normal">Units sold</th>
                                                                  <th className="py-2 px-3 text-right font-normal">Revenue</th>
                                                                  <th className="py-2 px-3 text-right font-normal">Gross profit</th>
                                                                  <th className="py-2 px-3 text-right font-normal">Margin</th>
                                                                  <th className="py-2 pl-3 text-right font-normal">Stock</th>
                                                                </tr>
                                                            </thead>
                                                              <tbody className="divide-y divide-[#171717]/[0.06] dark:divide-[#ededed]/[0.06] text-xs">
                                                                {products.length === 0 ? (
                                                                  <tr>
                                                                      <td colSpan={8} className="py-8 text-center text-xs text-[#737373] dark:text-[#85858b]">
                                                                        No products match the selected filters
                                                                      </td>
                                                                  </tr>
                                                                ) : (
                                                                  products.map((p) => (
                                                                        <tr
                                                                          key={p.product_id}
                                                                          className="hover:bg-[#fafafa] dark:hover:bg-[#232325]/40 transition-colors duration-150"
                                                                        >
                                                                          <td className="py-3 pr-4 font-medium text-[#171717] dark:text-[#ededed] whitespace-nowrap">
                                                                            {p.product_name}
                                                                          </td>
                                                                            <td className="py-3 px-3 whitespace-nowrap">
                                                                              <Badge variant="neutral">{p.category}</Badge>
                                                                            </td>
                                                                              <td className="py-3 px-3 text-right font-mono tabular-nums text-[#525252] dark:text-[#a1a1a6]">
                                                                                {formatCurrency(p.unit_price)}
                                                                              </td>
                                                                                <td className="py-3 px-3 text-right font-mono tabular-nums text-[#525252] dark:text-[#a1a1a6]">
                                                                                  {formatNumber(p.units_sold)}
                                                                                </td>
                                                                                  <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-[#171717] dark:text-[#ededed]">
                                                                                    {formatCurrency(p.revenue)}
                                                                                  </td>
                                                                                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#525252] dark:text-[#a1a1a6]">
                                                                                      {formatCurrency(p.gross_profit)}
                                                                                    </td>
                                                                                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#16a34a] dark:text-[#4cc38a]">
                                                                                        {(Number(p.margin_pct) || 0).toFixed(1)}%
                                                                                      </td>
                                                                                        <td className="py-3 pl-3 text-right font-mono tabular-nums text-[#525252] dark:text-[#a1a1a6]">
                                                                                          {formatNumber(p.stock_quantity)}
                                                                                        </td>
                                                                                      </tr>
                                                                                      ))
              )}
                                                                                    </tbody>
                                                                                  </table>
                                                                                </div>
                                                                              </Surface>
                                                                            </div>
                                                                            );
}
