import { motion } from "framer-motion";
import { Calendar, BarChart3, Bot, Package, ShoppingCart, Bell } from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Dashboard Analytics",
    description: "Visualisasi lengkap dengan chart interaktif untuk memantau pendapatan, transaksi, dan kategori terlaris.",
  },
  {
    icon: Bot,
    title: "AI Chatbot Cerdas",
    description: "Asisten AI yang siap menjawab pertanyaan stok, memberikan rekomendasi restock, dan analisis penjualan.",
  },
  {
    icon: Calendar,
    title: "Prediksi Musiman",
    description: "Analisis pola musiman, hari libur nasional, dan event khusus untuk prediksi yang lebih akurat.",
  },
  {
    icon: Package,
    title: "Manajemen Produk",
    description: "Kelola inventaris dengan mudah - tambah produk, atur kategori, dan pantau stok secara real-time.",
  },
  {
    icon: ShoppingCart,
    title: "Transaksi POS",
    description: "Sistem kasir modern dengan pencarian cepat, multi-item, dan berbagai metode pembayaran.",
  },
  {
    icon: Bell,
    title: "Notifikasi Stok",
    description: "Peringatan otomatis untuk stok rendah dan kritis agar bisnis Anda tetap berjalan lancar.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="fitur" className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Fitur Unggulan
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Solusi lengkap untuk manajemen stok dan prediksi penjualan bisnis retail Indonesia
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 text-primary">
                <feature.icon className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
