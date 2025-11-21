import { useState } from 'react';
import { TrendingUp, ShoppingBag, Package, AlertCircle } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDashboardMetrics, getSalesData, categorySales, criticalStockItems } from '../utils/mockData';
import { TimeRange } from '../types';

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
];

export function Dashboard() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('month');
  const metrics = getDashboardMetrics(selectedRange);
  const salesData = getSalesData(selectedRange);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-1">Dashboard</h1>
          <p className="text-slate-500">Welcome back! Here's your business overview</p>
        </div>
        <div className="flex gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setSelectedRange(range.value)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedRange === range.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {range.label}
            </button>
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
            <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full">
              +{metrics.revenueChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Total Revenue</h3>
          <p className="text-slate-900">${metrics.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">vs last period</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full">
              +{metrics.transactionsChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Total Transactions</h3>
          <p className="text-slate-900">{metrics.totalTransactions.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">vs last period</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full">
              +{metrics.itemsChange}%
            </span>
          </div>
          <h3 className="text-slate-500 mb-1">Items Sold</h3>
          <p className="text-slate-900">{metrics.totalItemsSold.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">vs last period</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200">
          <div className="mb-6">
            <h2 className="text-slate-900 mb-1">Sales Performance</h2>
            <p className="text-slate-500">Track your revenue trends</p>
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
            <h2 className="text-slate-900 mb-1">Top Categories</h2>
            <p className="text-slate-500">Best performing</p>
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
              <h3 className="text-red-900 mb-2">Critical Stock Alert</h3>
              <p className="text-red-700 mb-4">
                {criticalStockItems.length} item(s) are running low on stock
              </p>
              <div className="flex flex-wrap gap-2">
                {criticalStockItems.map((item) => (
                  <span
                    key={item.id}
                    className="px-3 py-1 bg-white text-red-700 rounded-full border border-red-200"
                  >
                    {item.name} ({item.stock} left)
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
