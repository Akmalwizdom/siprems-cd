import { motion } from "framer-motion";
import { TrendingDown, Clock, TrendingUp, AlertCircle } from "lucide-react";

const benefits = [
  {
    icon: TrendingDown,
    title: "Minimalisir Overstock",
    description: "Hindari pembelian berlebih dengan prediksi berbasis AI yang menganalisis tren penjualan dan pola musiman.",
  },
  {
    icon: Clock,
    title: "Dashboard Real-time",
    description: "Pantau pendapatan, transaksi, dan kategori terlaris secara langsung tanpa perlu menunggu laporan manual.",
  },
  {
    icon: TrendingUp,
    title: "Optimalkan Profit",
    description: "Maksimalkan keuntungan dengan stok yang tepat di waktu yang tepat berdasarkan rekomendasi AI.",
  },
  {
    icon: AlertCircle,
    title: "Pantau Stok Kritis",
    description: "Dapatkan notifikasi otomatis saat stok menipis sehingga bisnis Anda selalu siap melayani pelanggan.",
  },
];

const BenefitsSection = () => {
  return (
    <section className="py-20 bg-accent/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Apa Manfaatnya untuk Bisnis Anda?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Siprems membantu Anda mengambil keputusan berbasis data, bukan intuisi
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group relative rounded-2xl border border-border bg-card p-6 hover-lift"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <benefit.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
