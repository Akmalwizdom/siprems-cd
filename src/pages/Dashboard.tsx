import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { TrendingUp, ShoppingBag, Package, AlertCircle, Loader2, Trophy } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TimeRange, DashboardMetrics, CategorySales } from '../types';
import { formatIDR } from '../utils/currency';
import { Button } from '../components/ui/button';
import { API_BASE_URL } from '../config';
import { useRole } from '../context/AuthContext';
import { AdminOnly } from '../components/auth/RoleGuard';

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
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]); // All products for stock health
  const [criticalStockItems, setCriticalStockItems] = useState<any[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, salesRes, productsRes, categoryRes, todayRes] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/metrics?range=${selectedRange}`),
        fetch(`${API_BASE_URL}/dashboard/sales-chart`),
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/dashboard/category-sales`),
        fetch(`${API_BASE_URL}/dashboard/today`)
      ]);

      const metricsData = await metricsRes.json();
      const salesDataRaw = await salesRes.json();
      const productsData = await productsRes.json();
      const categoryData = await categoryRes.json();
      const todayData = await todayRes.json();

      setMetrics(metricsData);
      setSalesData(salesDataRaw);
      setCategorySales(categoryData);
      
      // Set top products from today's summary (top 5)
      if (todayData.products && Array.isArray(todayData.products)) {
        setTopProducts(todayData.products.slice(0, 5));
      }
      
      // Products now returns paginated format { data: [...], total, page, ... }
      const products = productsData.data || productsData;
      const productsList = Array.isArray(products) ? products : [];
      setAllProducts(productsList);
      // Critical items: stock below reorder_point (default 100) or below 50 units
      setCriticalStockItems(productsList.filter((p: any) => 
        p.stock < (p.reorder_point || 100) || p.stock < 50
      ));
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
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#3457D5' }}>
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
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#8A2BE2' }}>
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
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#6F00FF' }}>
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
        {/* Sales Performance Chart - Admin Only */}
        <AdminOnly>
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
        </AdminOnly>

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
                nameKey="category"
              >
                {categorySales.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  // Fallback to payload.category if name is index/undefined
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
            {categorySales.length === 0 && (
              <p className="text-sm text-slate-500">Belum ada data kategori</p>
            )}
            {categorySales.map((cat) => (
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

      {/* Stock Overview & Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Health Overview */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="mb-6">
            <h2 className="text-slate-900 mb-1">Status Stok</h2>
            <p className="text-slate-500">Gambaran kesehatan inventaris</p>
          </div>
          {(() => {
            // Calculate stock health based on all products and their reorder_point
            // Default reorder_point = 100 (high threshold for better visibility)
            const DEFAULT_REORDER_POINT = 100;
            const totalProducts = allProducts.length || 1;
            
            // Critical: stock < 50% of reorder_point or stock < 10
            const criticalProducts = allProducts.filter(p => 
              p.stock < (p.reorder_point || DEFAULT_REORDER_POINT) * 0.5 || p.stock < 10
            );
            
            // Low: stock < reorder_point but >= 50% of reorder_point
            const lowProducts = allProducts.filter(p => 
              p.stock < (p.reorder_point || DEFAULT_REORDER_POINT) && 
              p.stock >= (p.reorder_point || DEFAULT_REORDER_POINT) * 0.5 &&
              p.stock >= 10
            );
            
            // Healthy: stock >= reorder_point
            const healthyProducts = allProducts.filter(p => 
              p.stock >= (p.reorder_point || DEFAULT_REORDER_POINT)
            );
            
            const healthyPercent = Math.round((healthyProducts.length / totalProducts) * 100);
            const lowPercent = Math.round((lowProducts.length / totalProducts) * 100);
            const criticalPercent = Math.round((criticalProducts.length / totalProducts) * 100);
            
            const stockHealthData = [
              // Updated to solid Indigo theme
              { name: 'Sehat', value: healthyPercent, color: '#3457D5', count: healthyProducts.length },  // Royal Azure
              { name: 'Rendah', value: lowPercent, color: '#8A2BE2', count: lowProducts.length },         // Blue Violet
              { name: 'Kritis', value: criticalPercent, color: '#4B61D1', count: criticalProducts.length }, // Slate Indigo
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

        {/* Top Selling Products - Today - PREMIUM ENHANCED */}
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
            <>
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
            </>
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

      {/* Critical Stock Alert - Info Only */}
      {criticalStockItems.length > 0 && (
        <div 
          className="border rounded-xl p-6"
          style={{ backgroundColor: 'rgba(251, 191, 36, 0.3)', borderColor: 'rgba(245, 158, 11, 0.5)' }}
        >
          <div className="flex items-start gap-4">
            <div 
              className="p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.3)' }}
            >
              <AlertCircle className="w-6 h-6 text-amber-700" />
            </div>
            <div className="flex-1">
              <h3 className="text-amber-900 font-semibold mb-2">Perhatian: Stok Rendah</h3>
              <p className="text-amber-800 mb-4">
                {criticalStockItems.length} produk membutuhkan perhatian
              </p>
              <div className="flex flex-wrap gap-2">
                {criticalStockItems.slice(0, 6).map((item) => (
                  <span
                    key={item.id}
                    className="px-3 py-1 rounded-full text-sm font-medium border"
                    style={{
                      backgroundColor: item.stock < 50 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                      color: item.stock < 50 ? '#991b1b' : '#92400e',
                      borderColor: item.stock < 50 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    {item.name} ({item.stock} unit)
                  </span>
                ))}
                {criticalStockItems.length > 6 && (
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                    +{criticalStockItems.length - 6} lainnya
                  </span>
                )}
              </div>
              <div className="mt-4">
                <button 
                  onClick={() => navigate('/products')}
                  className="text-sm text-amber-700 hover:text-amber-800 hover:underline font-medium"
                >
                  Kelola di Halaman Produk →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
