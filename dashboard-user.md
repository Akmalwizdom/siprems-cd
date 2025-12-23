import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Search, 
  DollarSign, 
  Calendar,
  ChevronRight,
  Trophy,
  Utensils,
  Coffee
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';

// --- MOCK DATA ---

const MOCK_TODAY_METRICS = {
  revenue: 2540000,
  transactions: 42,
  itemsSold: 156,
};

const MOCK_HOURLY_SALES = [
  { time: '08:00', sales: 150000 },
  { time: '10:00', sales: 450000 },
  { time: '12:00', sales: 800000 },
  { time: '14:00', sales: 300000 },
  { time: '16:00', sales: 600000 },
  { time: '18:00', sales: 240000 },
];

const MOCK_LOW_STOCK = [
  { id: 1, name: 'Kopi Susu Gula Aren', stock: 3, unit: 'Cup' },
  { id: 2, name: 'Roti Bakar Coklat', stock: 5, unit: 'Porsi' },
  { id: 3, name: 'Teh Tarik Panas', stock: 8, unit: 'Cup' },
];

const MOCK_RECENT_TRANSACTIONS = [
  { id: 'TRX-001', time: '14:30', total: 45000, items: 3, method: 'Cash' },
  { id: 'TRX-002', time: '14:15', total: 120000, items: 5, method: 'QRIS' },
  { id: 'TRX-003', time: '13:50', total: 25000, items: 1, method: 'Cash' },
];

// DATA BARU: Produk Terlaris
const MOCK_TOP_PRODUCTS = [
  { id: 1, name: 'Kopi Susu Aren', category: 'beverage', sold: 45, price: 18000 },
  { id: 2, name: 'Croissant Butter', category: 'food', sold: 32, price: 25000 },
  { id: 3, name: 'Ice Lychee Tea', category: 'beverage', sold: 28, price: 22000 },
  { id: 4, name: 'Mie Goreng', category: 'food', sold: 15, price: 30000 },
];

// Warna untuk visualisasi Chart
const COLORS = ['#4F46E5', '#F59E0B', '#EC4899', '#10B981'];

// --- UTILS ---
const formatIDR = (value: number) => 
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

export default function UserDashboard() {
  const [currentDate] = useState(new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Halo, Kasir 👋</h1>
          <p className="text-slate-500 flex items-center gap-2 mt-1">
            <Calendar className="w-4 h-4" />
            {currentDate}
          </p>
        </div>
        <div className="flex gap-3">
            <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition flex items-center gap-2 shadow-sm">
                <Search className="w-4 h-4" /> Cek Stok
            </button>
            <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-md shadow-indigo-200">
                <ShoppingCart className="w-4 h-4" /> Transaksi Baru
            </button>
        </div>
      </div>

      {/* KEY METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Revenue */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-100 rounded-xl text-green-600 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">+12%</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Pendapatan Hari Ini</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatIDR(MOCK_TODAY_METRICS.revenue)}</h3>
        </div>

        {/* Transactions */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-6 h-6" />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">Total Transaksi</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{MOCK_TODAY_METRICS.transactions}</h3>
        </div>

        {/* Items Sold */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-100 rounded-xl text-orange-600 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">Produk Terjual</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{MOCK_TODAY_METRICS.itemsSold}</h3>
        </div>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Activity & Chart */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Hourly Performance Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Aktivitas Penjualan</h3>
                    <p className="text-slate-500 text-sm">Tren penjualan per jam hari ini</p>
                </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_HOURLY_SALES}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                    formatter={(value: number) => formatIDR(value)}
                  />
                  <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                    {MOCK_HOURLY_SALES.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.sales > 500000 ? '#4f46e5' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Transactions Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Transaksi Terakhir</h3>
              <button className="text-sm text-indigo-600 font-medium hover:underline flex items-center">
                  Lihat Semua <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">ID</th>
                    <th className="px-6 py-4 font-medium">Waktu</th>
                    <th className="px-6 py-4 font-medium">Metode</th>
                    <th className="px-6 py-4 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MOCK_RECENT_TRANSACTIONS.map((trx) => (
                    <tr key={trx.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-medium text-slate-900">{trx.id}</td>
                      <td className="px-6 py-4 text-slate-500 flex items-center gap-2"><Clock className="w-3 h-3" /> {trx.time}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${trx.method === 'QRIS' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{trx.method}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 text-right">{formatIDR(trx.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Best Sellers & Alerts */}
        <div className="space-y-6">
          
          {/* SECTION VISUAL: Produk Terlaris (Donut Chart) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                    <Trophy className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900">Paling Laris</h3>
                    <p className="text-xs text-slate-500">Distribusi penjualan item</p>
                </div>
            </div>
            
            {/* Chart Area */}
            <div className="h-[200px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={MOCK_TOP_PRODUCTS}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="sold"
                        >
                            {MOCK_TOP_PRODUCTS.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip 
                             formatter={(value: number) => [`${value} item`, 'Terjual']}
                             contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Label */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <span className="block text-2xl font-bold text-slate-800">
                        {MOCK_TOP_PRODUCTS.reduce((acc, curr) => acc + curr.sold, 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total</span>
                </div>
            </div>
            
            {/* Custom Legend / List */}
            <div className="space-y-3 mt-2">
                {MOCK_TOP_PRODUCTS.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition">
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                            />
                            <div>
                                <h4 className="font-medium text-slate-800 text-sm leading-tight">{item.name}</h4>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] text-slate-400">
                                        {item.category === 'beverage' ? 'Minuman' : 'Makanan'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block font-bold text-slate-900 text-sm">{item.sold}</span>
                        </div>
                    </div>
                ))}
            </div>
          </div>

          {/* Critical Stock Alert */}
          <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-red-900">Stok Menipis</h3>
            </div>
            <div className="space-y-3">
              {MOCK_LOW_STOCK.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-xl border border-red-100 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                    <p className="text-xs text-slate-500">Sisa stok</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-red-600 text-lg">{item.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}