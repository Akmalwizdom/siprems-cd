import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { TrendingUp, ShoppingBag, Package, Loader2, Trophy } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TimeRange, DashboardMetrics, CategorySales } from '../types';
import { formatIDR } from '../utils/currency';
import { Button } from '../components/ui/Button';
import { useRole } from '../context/AuthContext';
import { useDashboardData } from '../hooks';

interface TopProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
];

// Helper function to format large numbers in Indonesian style
const formatCompactNumber = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  } else if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  } else if (value >= 1_000) {
    return `Rp ${(value / 1_000).toFixed(0)}rb`;
  }
  return `Rp ${value.toLocaleString('id-ID')}`;
};

// Format number without currency prefix (for counts)
const formatNumber = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}M`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}jt`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}rb`;
  }
  return value.toLocaleString('id-ID');
};

export function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  // Users can only see 'today' metrics, admins can see all time ranges
  const [selectedRange, setSelectedRange] = useState<TimeRange>(isAdmin ? 'month' : 'today');

  // React Query hooks - data is cached and instantly available on revisits
  const { metrics, salesChart, categorySales, todaySummary, products, isLoading } = useDashboardData(selectedRange);

  // Derive data from React Query results
  const metricsData = metrics.data as DashboardMetrics | undefined;
  const salesData = salesChart.data || [];
  const categorySalesData: CategorySales[] = categorySales.data || [];
  const allProducts = products.data || [];
  
  // Top products from today's summary
  const topProducts: TopProduct[] = useMemo(() => {
    const todayData = todaySummary.data;
    if (todayData?.products && Array.isArray(todayData.products)) {
      return todayData.products.slice(0, 5);
    }
    return [];
  }, [todaySummary.data]);



  if (isLoading || !metricsData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Use metricsData instead of metrics for the rest of the component
  const displayMetrics = metricsData;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-1">Dashboard</h1>
          <p className="text-slate-500">Selamat datang! Berikut ringkasan bisnis Anda</p>
        </div>
        <div className="flex gap-2">
          {/* Users can only view 'today' metrics, Admins can view all time ranges */}
          {timeRanges
            .filter((range) => isAdmin || range.value === 'today')
            .map((range) => (
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
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#10B981' }}>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className={`${displayMetrics.revenueChange >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-3 py-1 rounded-full`}>
              {displayMetrics.revenueChange >= 0 ? '+' : ''}{displayMetrics.revenueChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Total Pendapatan</h3>
          <p className="text-slate-900">{formatIDR(displayMetrics.totalRevenue)}</p>
          <p className="text-xs text-slate-400 mt-2">vs periode sebelumnya</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#6366F1' }}>
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <span className={`${displayMetrics.transactionsChange >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-3 py-1 rounded-full`}>
              {displayMetrics.transactionsChange >= 0 ? '+' : ''}{displayMetrics.transactionsChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Total Transaksi</h3>
          <p className="text-slate-900">{displayMetrics.totalTransactions.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">vs periode sebelumnya</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#F59E0B' }}>
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className={`${displayMetrics.itemsChange >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-3 py-1 rounded-full`}>
              {displayMetrics.itemsChange >= 0 ? '+' : ''}{displayMetrics.itemsChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Barang Terjual</h3>
          <p className="text-slate-900">{displayMetrics.totalItemsSold.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">vs periode sebelumnya</p>
        </div>
      </div>

      {/* Charts Section */}
      {isAdmin ? (
        /* Admin Layout: Performance Chart (2 cols) + Kategori (1 col) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Performance Chart - Admin Only */}
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
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12}
                  tickFormatter={(value) => formatCompactNumber(value)}
                />
                <Tooltip
                  formatter={(value: number) => [formatCompactNumber(value), 'Penjualan']}
                  labelFormatter={(label) => `Tanggal: ${label}`}
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

          {/* Top Selling Categories - Admin View */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-slate-900 mb-1">Kategori Teratas</h2>
              <p className="text-slate-500">Performa terbaik</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categorySalesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="category"
                >
                  {categorySalesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => {
                    const categoryName = props?.payload?.category || name;
                    return [formatIDR(value), categoryName];
                  }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: '#1e293b', fontWeight: 500 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {categorySalesData.length === 0 && (
                <p className="text-sm text-slate-500">Belum ada data kategori</p>
              )}
              {categorySalesData.map((cat) => (
                <div key={cat.category} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 min-w-[12px] min-h-[12px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  ></div>
                  <span className="text-xs text-slate-600">{cat.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* User Layout: Kategori & Produk Terlaris Side-by-Side (Flexbox Forced) */
        <div className="flex flex-row flex-wrap gap-6 w-full">
          {/* Left: Kategori Teratas */}
          <div className="w-full md:w-[48%] flex-1 bg-white rounded-xl p-6 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-slate-900 mb-1">Kategori Teratas</h2>
              <p className="text-slate-500">Performa terbaik</p>
            </div>
            <ResponsiveContainer width="99%" height={250}>
              <PieChart>
                <Pie
                  data={categorySalesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="category"
                >
                  {categorySalesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => {
                    const categoryName = props?.payload?.category || name;
                    return [formatIDR(value), categoryName];
                  }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: '#1e293b', fontWeight: 500 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
            {categorySalesData.length === 0 && (
                <p className="text-sm text-slate-500">Belum ada data kategori</p>
              )}
            {categorySalesData.map((cat) => (
                <div key={cat.category} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 min-w-[12px] min-h-[12px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  ></div>
                  <span className="text-sm text-slate-600">{cat.category}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Produk Terlaris */}
          <div className="w-full md:w-[48%] flex-1 bg-white rounded-xl p-6 border border-slate-200 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-slate-900 font-bold text-lg">Produk Terlaris</h2>
                  <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-100">
                    Live
                  </div>
                </div>
                <p className="text-slate-500 text-sm">Top 5 penjualan real-time</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl">
                <Trophy className="w-6 h-6 text-white" />
              </div>
            </div>
            
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="99%" height={250}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={12}
                    fontWeight={500}
                    width={110}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value.length > 14 ? value.slice(0, 14) + '...' : value}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'quantity') return [`${value} item`, 'Terjual'];
                      return [formatIDR(value), 'Pendapatan'];
                    }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="quantity" 
                    fill="#6366f1" 
                    radius={[0, 6, 6, 0]} 
                    barSize={24}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
                <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                  <Trophy className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">Belum ada transaksi hari ini</p>
                <div className="mt-4">
                  <button 
                    onClick={() => navigate('/transaction')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm shadow-indigo-200"
                  >
                    Buat Transaksi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin: Stock Overview & Top Products Row */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stock Health Overview */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-slate-900 mb-1">Status Stok</h2>
              <p className="text-slate-500">Gambaran kesehatan inventaris</p>
            </div>
            {(() => {
              const DEFAULT_REORDER_POINT = 100;
              const totalProducts = allProducts.length || 1;
              const criticalProducts = allProducts.filter(p => 
                p.stock < (p.reorder_point || DEFAULT_REORDER_POINT) * 0.5 || p.stock < 10
              );
              const lowProducts = allProducts.filter(p => 
                p.stock < (p.reorder_point || DEFAULT_REORDER_POINT) && 
                p.stock >= (p.reorder_point || DEFAULT_REORDER_POINT) * 0.5 &&
                p.stock >= 10
              );
              const healthyProducts = allProducts.filter(p => 
                p.stock >= (p.reorder_point || DEFAULT_REORDER_POINT)
              );
              const healthyPercent = Math.round((healthyProducts.length / totalProducts) * 100);
              const lowPercent = Math.round((lowProducts.length / totalProducts) * 100);
              const criticalPercent = Math.round((criticalProducts.length / totalProducts) * 100);
              
              const stockHealthData = [
                { name: 'Sehat', value: healthyPercent, color: '#10B981', count: healthyProducts.length },
                { name: 'Rendah', value: lowPercent, color: '#F59E0B', count: lowProducts.length },
                { name: 'Kritis', value: criticalPercent, color: '#EF4444', count: criticalProducts.length },
              ].filter(d => d.value > 0);

              return (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stockHealthData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {stockHealthData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `${value}%`}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                    {stockHealthData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-sm text-slate-600">
                          {item.name}: {item.value}% ({item.count} produk)
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <button 
                      onClick={() => navigate('/products')}
                      className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      Lihat Detail Stok →
                    </button>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Top Selling Products - Admin */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-slate-900 font-bold text-lg">Produk Terlaris Hari Ini</h2>
                  <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-100">
                    Live
                  </div>
                </div>
                <p className="text-slate-500 text-sm">Top 5 performer berdasarkan penjualan real-time</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl">
                <Trophy className="w-6 h-6 text-white" />
              </div>
            </div>
            
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={12}
                    fontWeight={500}
                    width={110}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => value.length > 14 ? value.slice(0, 14) + '...' : value}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'quantity') return [`${value} item`, 'Terjual'];
                      return [formatIDR(value), 'Pendapatan'];
                    }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="quantity" 
                    fill="#6366f1" 
                    radius={[0, 6, 6, 0]} 
                    barSize={24}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
                <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                  <Trophy className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">Belum ada transaksi hari ini</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">Transaksi penjualan akan muncul di sini</p>
                <button 
                  onClick={() => navigate('/transaction')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm shadow-indigo-200"
                >
                  Buat Transaksi Baru
                </button>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
