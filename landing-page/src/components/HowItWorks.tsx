import { motion } from "framer-motion";
import { UserPlus, Package, ShoppingCart, Sparkles } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Daftar & Setup Toko",
    description: "Buat akun gratis dan lengkapi profil toko Anda dalam hitungan menit.",
  },
  {
    icon: Package,
    step: "02",
    title: "Tambah Produk",
    description: "Input data produk lengkap dengan kategori, harga, dan stok awal.",
  },
  {
    icon: ShoppingCart,
    step: "03",
    title: "Catat Transaksi",
    description: "Gunakan fitur POS untuk mencatat setiap penjualan secara real-time.",
  },
  {
    icon: Sparkles,
    step: "04",
    title: "Dapatkan Prediksi AI",
    description: "AI menganalisis data dan memberikan rekomendasi restock yang akurat.",
  },
];

const HowItWorks = () => {
  return (
    <section id="integrasi" className="py-20 bg-gradient-to-b from-background to-accent/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Cara Kerja Siprems
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Empat langkah sederhana untuk memulai prediksi stok yang lebih cerdas
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent hidden lg:block" />

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="rounded-2xl border border-border bg-card p-6 text-center hover:border-primary/50 transition-colors">
                  {/* Step Number */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-bold text-primary-foreground">
                    {step.step}
                  </div>
                  
                  <div className="mb-4 mt-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary">
                    <step.icon className="h-8 w-8" />
                  </div>
                  
                  <h3 className="mb-3 text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
