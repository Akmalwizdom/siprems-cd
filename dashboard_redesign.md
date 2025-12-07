# Prompt untuk AI Agent — Rebuild Dashboard sesuai Design Lampiran

**Tujuan:** Modifikasi layout, komponen, dan style halaman Dashboard (yang sudah ada) sehingga meniru estetika dan perilaku dari design image yang saya lampirkan (design dashboard.jpg). Gunakan prinsip-prinsip frontend-design pada SKILL.md (tipografi karakter, CSS variables, gerakan halus, komposisi ruang, dan visual details). Hasil akhir harus siap di-integrasikan ke frontend React + Tailwind (atau library sejenis) dan mengikuti aturan design di SKILL.md.

## Catatan penting

- anda bisa mengabaikan aturan design seperti warna, ukuran: padding, margin, dll jika tidak sesuai pada (design dashboard.jpg)

## 1) Aturan Umum Visual & Arsitektur 

**Tone & Aesthetic:** refined/minimal dengan aksen biru tegas (seperti lampiran). Gunakan panel bulat (rounded 16–24px), bayangan lembut, dan latar warm-gray. Hindari default fonts "Inter/Roboto" — pilih display font berkarakter untuk headings (contoh: "Space Grotesk" HANYA jika tersedia, atau Google Font alternatif berkarakter), dan pasangan body font serif-sans yang bersih. (Jika tidak tersedia, beri fallback ke system-ui.)

**CSS Variables / Tailwind tokens** — definisikan di :root / tailwind.config:
```css
--bg: #f6f7f8;
--card-bg: #ffffff;
--muted: #9aa4b2;
--primary: #0b6ff2; /* aksen biru */
--accent: #00c389;  /* hijau kecil di badges */
--danger: #ff6060;
--glass: rgba(255,255,255,0.6);
--shadow-1: 0 6px 18px rgba(15,23,42,0.06);
--radius-lg: 20px;
```

**Grid Layout:** Gunakan 12-col responsive grid. Pada desktop: sidebar (col 2–3) + content (col 9–10). Konten utama terstruktur 3 kolom card besar di atas + 2 kolom area grafik di bawah (lihat mapping komponen di bawah).

**Spacing & Scale:** Gunakan modular scale (8px baseline). Padding card: p-6–p-8. Corner rounded-[var(--radius-lg)].

**Motion:** Halus, singkat (200–350ms). Gunakan staggered reveal pada load (0.03s delay per card). Hover: lift (translateY -6px) + shadow-boost.

## 2) Mapping Komponen 

Setiap poin beri instruksi UI, data binding, chart style & formatting.

### A. Performa Penjualan → gunakan style "Income Sources" dari lampiran

**Letak:** Besar, kiri bawah area utama (utama visual pada bagian content).

**Visual:** Card putih besar dengan header kecil "Performa Penjualan" dan subjudul "Pantau tren pendapatan Anda" (bahasa Indonesia). Di kanan atas card sediakan control: Sort by Month dropdown dan All Sources filter (mirip lampiran).

**Chart:** Gunakan bar chart bertumpuk/column yang terlihat 'berlapis' dengan sudut bulat. Setiap bar memiliki dekor stripe pattern untuk highlight highest bar—imitasi lampiran (vertical bars with diagonal stripes on the top).

**Data labels:** Angka ringkas di atas setiap bar (format: Rp 7,7K atau Rp 7,7JT sesuai skala). Tooltip: full formatted Rupiah (Rp 7.720.000) + breakdown sumber.

**Color & style:** Palet biru gradient; gunakan 3 tingkatan biru untuk series (dark → mid → light). Stroke lembut, area fill gradient & subtle shadow inside.

**Micro-interactions:** Hover bar → expand width + show tooltip + subtle brightness increase.

**Accessibility:** Provide aria-label for chart region and keyboard focus on bars.

**Implementation tips:** Chart library: Chart.js atau ECharts. Konfigurasi: barRadius: 8, barPercentage: 0.65, categoryPercentage: 0.75, plugins.tooltip.callbacks.label untuk rupiah.

### B. Total Pendapatan & Total Transaksi → ikuti style "Today Received"

**Letak:** Top row (kartu KPI kecil) — dua kartu berdampingan atau satu diikuti oleh KPI lain.

**Visual:** Card ringkas, rounded, dengan large number di tengah (display font), sub-label kecil di atas. Di bawah angka, tunjukkan persentase perubahan bulanan (dalam pill kecil).

**Formatting angka:**

- Display: Rp 333,0 Jt (gunakan short scale Indonesia: Rp 333,0 Jt atau Rp 333,0M jika besar).

**Badge:** Persentase change — gunakan pill dengan ikon panah (↑/↓) dan warna: hijau untuk positif, warna soft-danger untuk negatif.

**Small chart (sparklines):** Tambahkan mini-sparkline di bawah angka (1 bar height 22px) yang menunjukkan trend.

**Implementation tips:** Gunakan CSS for big typography + number formatter:
```javascript
new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
```

and for short format implement helper (e.g., formatShortRupiah()).

### C. Barang Terjual → ikuti style "Financial Report" (kotak gelap kecil)

**Letak:** Top-right atau sebelah KPI cards.

**Visual:** Small dark card (black/charcoal background) seperti "Financial Report" pada lampiran: rounded, dengan icon besar (box) di kiri, teks utama (angka barang) besar berwarna putih, sublabel lebih kecil.

**Interactions:** Card memiliki dua icon kecil di kanan atas (download / share) mirip lampiran.

**Formatting:** 3.891 + subtext vs periode sebelumnya. Jika penurunan/peningkatan, tampilkan badge kecil di bawah.

**Implementation tips:** Gunakan bg-[#0f1724] with glassy overlay and subtle inner shadow.

### D. Kategori Teratas → ikuti style "Expense Breakdown" (bubble grid)

**Letak:** Sidebar kanan atau area card kanan bawah (sesuai lampiran).

**Visual:** Grid bubbles (circle matrix) yang merepresentasikan kategori (size = volume). Atau gunakan donut/polar chart. Untuk konsistensi dengan lampiran, prefer matrix of circular dots dengan legend di bawah.

**Label:** Setiap kategori dilegend dengan warna dan angka omzet (format Rupiah short). Tambahkan tooltip on hover yang menampilkan: nama kategori, total omzet (Rp full), % dari total.

**Colors:** Pastel palette with one strong accent (primary blue) for top category.

**Implementation tips:** Jika menggunakan CSS grid untuk bubble matrix, compute circle sizes proportionally and place into 7x? grid; for accessibility include textual list next to chart.

### E. Financial Balance (tambahkan sebelah Performa Penjualan)

**Letak:** Beside the Performa Penjualan card (right column) — card vertical ringkas.

**Visual:** Semi-circular gauge / arc chart (mirip lampiran "Financial Balance" gauge). Tampilkan percentage change (e.g., 22% from yesterday) and small legend: Total & Profit Today.

**Details:** Add small sparkline under the gauge and small CTA (export/snap).

**Implementation tips:** Use SVG donut gauge with gradient stroke and animated transition on load.

### F. Join Our Financial Class Mastery → biarkan kosong isinya

**Letak:** Top-right hero banner.

**Requirement:** Reserve the card with exact shape, rounded, secondary background (dark banner) and a CTA Join Class button on the right. Do not fill content — leave inner content empty placeholder (agent must leave blank text area).

## 3) Data & Formatting Rules (Wajib)

Semua angka mata uang harus menggunakan locale id-ID dan currency IDR untuk formatting tooltips. Untuk tampilan ringkas gunakan helper formatRupiahShort(value) menghasilkan: Rp 1,2 Jt, Rp 7,7K -> Prefer Jt untuk jutaan, M untuk milyar.

Sumbu Y pada chart harus menampilkan unit (contoh: Rp 0, Rp 200 Jt), tidak menampilkan plain 0000000.

**Missing data handling:** Jika data hari terakhir kosong/null, jangan menggambar drop-to-zero — gunakan interpolation linear atau display — dan greyed-out area di grafik terakhir. Tambahkan small annotation: "Data belum tersedia untuk X hari."

**Time zone & date formatting:** gunakan id-ID untuk tanggal di x-axis (2025-09-10 → 10 Sep 2025) jika diperlukan.

**Colors for changes:** positive = --accent, negative = --danger but softer (opacity 0.92).

## 4) Technical Implementation Checklist 

Buat checklist langkah demi langkah yang agent jalankan.

1. Setup theme tokens di globals.css & tailwind.config (sertakan CSS variables di awal).

2. Typography: import chosen display font & body font. Override Tailwind fontFamily.

3. Layout: implement responsive grid: Sidebar + Main content. Pastikan card components share same card utility class.

4. Components to create / modify:
   - KpiCard (for Total Pendapatan & Total Transaksi) — supports bigNumber, small sparkline, changeBadge.
   - SmallDarkCard (for Barang Terjual) — dark theme, action icons.
   - IncomeSourcesCard (for Performa Penjualan) — large BarChart with filters.
   - ExpenseBubbleGrid (for Kategori Teratas) — bubble matrix + legend.
   - GaugeCard (for Financial Balance) — SVG donut.
   - HeroBanner (Join Class) — placeholder empty.

5. Charts: use Chart.js or ECharts. Provide config examples in code: radius, gradients, tooltips callbacks (format Rupiah), responsive. Use animation: { duration: 350 }.

6. Micro interactions: CSS transitions for .card:hover and focus states. Add data-animate attributes and lifecycle animation on mount with staggered delays.

7. Accessibility: All charts must have role="img" and aria-label with summary. Provide keyboard focus order and tabindex on interactive elements.

8. Testing: Validate on breakpoints 1280, 1024, 768, 480. Ensure legends wrap on mobile.

## 5) Example Code Snippets (minimal, to follow style)

Gunakan ini sebagai template implementasi Tailwind + React.

**Tailwind tokens (tailwind.config.js extract):**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#0b6ff2',
        accent: '#00c389',
        danger: '#ff6060',
        card: '#ffffff',
        bg: '#f6f7f8',
      },
      borderRadius: {
        lg: '20px',
      },
      boxShadow: {
        'soft': '0 6px 18px rgba(15,23,42,0.06)',
      },
      fontFamily: {
        display: ['"YourDisplayFont"', 'system-ui'],
        body: ['"YourBodyFont"', 'system-ui'],
      }
    }
  }
}
```

**Number formatting helper (JS):**
```javascript
function formatRupiahShort(v) {
  if (v >= 1_000_000_000) return `Rp ${ (v/1_000_000_000).toFixed(1) }M`;
  if (v >= 1_000_000) return `Rp ${ (v/1_000_000).toFixed(1) } Jt`;
  if (v >= 1000) return `Rp ${ (v/1000).toFixed(1) }K`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);
}
```

**Chart tooltip callback (Chart.js):**
```javascript
callbacks: {
  label: function(ctx) {
    const val = ctx.parsed.y;
    return formatFullRupiah(val); // Rp 7.720.000
  }
}
```

## 6) Catatan desain spesifik (detail kecil yang penting)

- Gunakan rounded big corners dan soft shadows untuk card — jangan gunakan flat borders.
- Gunakan stripe pattern pada tallest bar (income sources) untuk menyampaikan "highlight".
- Buttons: pill px-4 py-2 rounded-full, primary fill --primary, subtle glass border for secondary.
- Legends: small rounded pills with color dot & label to right.
- Jangan menampilkan angka 0000000 di y-axis — always format.
- Untuk dark card (Barang Terjual) gunakan white-on-dark typography with font-weight: 700 for number.

