import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Package, AlertCircle, Loader2 } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TimeRange, DashboardMetrics, CategorySales } from '../types';
import { formatIDR } from '../utils/currency';
import { Button } from '../components/ui/button';

const API_BASE_URL = 'http://localhost:8000/api';

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
];

export function Dashboard() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('month');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [criticalStockItems, setCriticalStockItems] = useState<any[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, salesRes, productsRes, categoryRes] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/metrics`),
        fetch(`${API_BASE_URL}/dashboard/sales-chart`),
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/dashboard/category-sales`)
      ]);

      const metricsData = await metricsRes.json();
      const salesDataRaw = await salesRes.json();
      const productsData = await productsRes.json();
      const categoryData = await categoryRes.json();

      setMetrics(metricsData);
      setSalesData(salesDataRaw);
      setCategorySales(categoryData);
      setCriticalStockItems(productsData.filter((p: any) => p.stock < 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-1">Dashboard</h1>
          <p className="text-slate-500">Selamat datang! Berikut ringkasan bisnis Anda</p>
        </div>
        <div className="flex gap-2">
          {timeRanges.map((range) => (
            <Button
              key={range.value}
              onClick={() => setSelectedRange(range.value)}
              variant={selectedRange === range.value ? 'default' : 'outline'}
              size="sm"
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className={`${metrics.revenueChange >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-3 py-1 rounded-full`}>
              {metrics.revenueChange >= 0 ? '+' : ''}{metrics.revenueChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Total Pendapatan</h3>
          <p className="text-slate-900">{formatIDR(metrics.totalRevenue)}</p>
          <p className="text-xs text-slate-400 mt-2">vs periode sebelumnya</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <span className={`${metrics.transactionsChange >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-3 py-1 rounded-full`}>
              {metrics.transactionsChange >= 0 ? '+' : ''}{metrics.transactionsChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Total Transaksi</h3>
          <p className="text-slate-900">{metrics.totalTransactions.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">vs periode sebelumnya</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className={`${metrics.itemsChange >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-3 py-1 rounded-full`}>
              {metrics.itemsChange >= 0 ? '+' : ''}{metrics.itemsChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Barang Terjual</h3>
          <p className="text-slate-900">{metrics.totalItemsSold.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">vs periode sebelumnya</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200">
          <div className="mb-6">
            <h2 className="text-slate-900 mb-1">Performa Penjualan</h2>
            <p className="text-slate-500">Pantau tren pendapatan Anda</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#4f46e5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Selling Categories */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="mb-6">
            <h2 className="text-slate-900 mb-1">Kategori Teratas</h2>
            <p className="text-slate-500">Performa terbaik</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categorySales}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {categorySales.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {categorySales.length === 0 && (
              <p className="text-sm text-slate-500">Belum ada data kategori</p>
            )}
            {categorySales.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  ></div>
                  <span className="text-slate-700">{cat.category}</span>
                </div>
                <span className="text-slate-900">{cat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Stock Alert */}
      {criticalStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-900 mb-2">Peringatan Stok Kritis</h3>
              <p className="text-red-700 mb-4">
                {criticalStockItems.length} barang hampir habis
              </p>
              <div className="flex flex-wrap gap-2">
                {criticalStockItems.map((item) => (
                  <span
                    key={item.id}
                    className="px-3 py-1 bg-white text-red-700 rounded-full border border-red-200"
                  >
                    {item.name} (tersisa {item.stock})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
