import { motion } from "framer-motion";
import { TrendingUp, ShoppingBag, Package, MessageSquare, Send } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";

// Data penjualan untuk chart
const salesData = [
  { name: "Sen", sales: 2500000 },
  { name: "Sel", sales: 3200000 },
  { name: "Rab", sales: 2800000 },
  { name: "Kam", sales: 4100000 },
  { name: "Jum", sales: 3800000 },
  { name: "Sab", sales: 5200000 },
  { name: "Min", sales: 4500000 },
];

// Data kategori
const categoryData = [
  { category: "Sembako", value: 45, color: "#6366F1" },
  { category: "Minuman", value: 25, color: "#10B981" },
  { category: "Snack", value: 20, color: "#F59E0B" },
  { category: "Lainnya", value: 10, color: "#EC4899" },
];

const statsCards = [
  { 
    icon: TrendingUp, 
    label: "Total Pendapatan", 
    value: "Rp 24.5jt", 
    change: "+12%",
    color: "text-emerald-600", 
    bg: "bg-emerald-50",
    iconBg: "bg-emerald-500"
  },
  { 
    icon: ShoppingBag, 
    label: "Total Transaksi", 
    value: "156", 
    change: "+8%",
    color: "text-indigo-600", 
    bg: "bg-indigo-50",
    iconBg: "bg-indigo-500"
  },
  { 
    icon: Package, 
    label: "Barang Terjual", 
    value: "892", 
    change: "+15%",
    color: "text-amber-600", 
    bg: "bg-amber-50",
    iconBg: "bg-amber-500"
  },
];

interface DashboardPreviewProps {
  compact?: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(1)}jt`;
  }
  return `Rp ${(value / 1000).toFixed(0)}rb`;
};

const DashboardPreview = ({ compact = false }: DashboardPreviewProps) => {
  return (
    <div className={`rounded-2xl bg-card ${compact ? "p-4" : "p-6"}`}>
      {/* Stats Cards */}
      <div className={`grid gap-4 ${compact ? "grid-cols-3 mb-4" : "grid-cols-1 sm:grid-cols-3 mb-6"}`}>
        {statsCards.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
            className={`flex items-center gap-3 rounded-xl bg-card border border-border p-4`}
          >
            <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
              <stat.icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs text-muted-foreground ${compact ? "hidden sm:block" : ""}`}>{stat.label}</p>
              <div className="flex items-center gap-2">
                <p className={`font-bold text-foreground ${compact ? "text-sm" : "text-lg"}`}>{stat.value}</p>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{stat.change}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className={`grid gap-6 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"}`}>
        {/* Main Chart - Performa Penjualan */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className={`rounded-xl border border-border bg-card p-4 ${compact ? "" : "lg:col-span-2"}`}
        >
          <div className="mb-4">
            <h3 className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>
              Performa Penjualan
            </h3>
            <p className="text-xs text-muted-foreground">Pantau tren pendapatan Anda</p>
          </div>
          
          <ResponsiveContainer width="100%" height={compact ? 150 : 220}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} 
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Penjualan']}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px"
                }} 
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorSales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Kategori Teratas */}
        {!compact && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="mb-4">
              <h3 className="font-semibold text-foreground">Kategori Teratas</h3>
              <p className="text-xs text-muted-foreground">Performa terbaik</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, '']}
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px"
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {categoryData.map((cat) => (
                <div key={cat.category} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-xs text-muted-foreground">{cat.category}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Chatbot Widget */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 rounded-xl border border-primary/20 bg-accent p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">AI Assistant</p>
              <p className="mt-1 text-sm text-muted-foreground">
                "Berdasarkan analisis, stok <span className="font-semibold text-foreground">Beras Premium 5kg</span> diprediksi 
                habis dalam <span className="font-semibold text-primary">3 hari</span>. Disarankan restock 
                <span className="font-semibold text-primary"> +50 unit</span> segera."
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="Tanya AI tentang stok..." 
                    className="w-full h-8 px-3 pr-8 text-xs rounded-lg border border-border bg-background"
                    disabled
                  />
                  <Send className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <Button size="sm" variant="default" className="h-8 text-xs">
                  <Package className="mr-1 h-3 w-3" />
                  Isi Stok
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardPreview;
