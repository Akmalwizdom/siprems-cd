import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { EventClassification } from '../types';

const genai = new GoogleGenerativeAI(config.gemini.apiKey);

class GeminiService {
    private model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    async classifyEvent(
        title: string,
        description?: string,
        date?: string
    ): Promise<EventClassification> {
        const prompt = `Kamu adalah sistem klasifikasi event untuk toko retail di Indonesia.

Klasifikasikan event berikut ke dalam TEPAT SATU dari 4 kategori ini:
1. promotion - Diskon, sale, promo, flash sale, buy 1 get 1, special offer
2. holiday - Hari libur nasional, hari raya, natal, lebaran, tahun baru, ramadan
3. store-closed - Toko tutup, renovasi, maintenance, libur khusus toko
4. event - Acara umum, festival, kompetisi, gathering, atau yang tidak termasuk kategori lain

Event yang akan diklasifikasi:
- Judul: ${title}
- Tanggal: ${date || 'tidak disebutkan'}
- Deskripsi: ${description || 'tidak ada'}

Berikan respons dalam format JSON SAJA (tanpa markdown, tanpa penjelasan lain):
{"category": "nama_kategori", "confidence": 0.0-1.0, "rationale": "alasan singkat dalam bahasa Indonesia"}

Pastikan category adalah SALAH SATU dari: promotion, holiday, store-closed, event`;

        try {
            const result = await this.model.generateContent(prompt);
            let responseText = result.response.text().trim();

            // Clean up markdown code blocks if present
            if (responseText.startsWith('```')) {
                responseText = responseText.replace(/^```(?:json)?\n?/, '');
                responseText = responseText.replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(responseText);

            // Validate and normalize category
            const validCategories = ['promotion', 'holiday', 'store-closed', 'event'];
            const category = validCategories.includes(parsed.category.toLowerCase())
                ? parsed.category.toLowerCase()
                : 'event';

            const confidence = Math.min(Math.max(parsed.confidence || 0.7, 0), 1);

            // Event classified

            return {
                category,
                confidence,
                rationale: parsed.rationale || 'Diklasifikasi oleh Gemini AI',
            };
        } catch (error) {
            console.error('[Gemini] Classification error:', error);

            // Fallback to keyword-based classification
            return this.keywordFallback(title);
        }
    }

    private keywordFallback(title: string): EventClassification {
        const titleLower = title.toLowerCase();

        const promotionKeywords = ['promo', 'diskon', 'discount', 'sale', 'flash', 'offer', 'beli', 'gratis', 'free', 'potongan', 'hemat'];
        const holidayKeywords = ['natal', 'christmas', 'lebaran', 'idul', 'eid', 'ramadan', 'tahun baru', 'new year', 'imlek', 'nyepi', 'waisak', 'libur', 'holiday'];
        const closedKeywords = ['tutup', 'closed', 'renovasi', 'maintenance', 'perbaikan', 'libur toko'];

        if (promotionKeywords.some(kw => titleLower.includes(kw))) {
            return {
                category: 'promotion',
                confidence: 0.8,
                rationale: 'Terdeteksi kata kunci promosi dalam judul',
            };
        }

        if (holidayKeywords.some(kw => titleLower.includes(kw))) {
            return {
                category: 'holiday',
                confidence: 0.85,
                rationale: 'Terdeteksi kata kunci hari libur dalam judul',
            };
        }

        if (closedKeywords.some(kw => titleLower.includes(kw))) {
            return {
                category: 'store-closed',
                confidence: 0.9,
                rationale: 'Terdeteksi kata kunci toko tutup dalam judul',
            };
        }

        return {
            category: 'event',
            confidence: 0.6,
            rationale: 'Tidak terdeteksi kata kunci spesifik, dikategorikan sebagai acara umum',
        };
    }

    async chat(
        message: string,
        predictionData: any | null,
        chatHistory: Array<{ role: string; content: string }>
    ): Promise<{ response: string; action: any }> {
        // Build context from prediction data
        let contextInfo = '';
        let hasRecommendations = false;

        if (predictionData) {
            // Process recommendations data
            if (predictionData.recommendations && predictionData.recommendations.length > 0) {
                hasRecommendations = true;
                const recommendations = predictionData.recommendations
                    .slice(0, 10)
                    .map((r: any, idx: number) => `${idx + 1}. ${r.productName} (kategori: ${r.category || 'N/A'}) - stok saat ini: ${r.currentStock} unit, prediksi kebutuhan: ${r.predictedDemand} unit, rekomendasi restock: ${r.recommendedRestock} unit, urgensi: ${r.urgency}`)
                    .join('\n');

                // Recommendations data processed

                contextInfo += `

=== DATA REKOMENDASI RESTOCK AKTUAL DARI SISTEM ===
${recommendations}
=== AKHIR DATA REKOMENDASI ===
`;
            }

            // Process chart data for sales prediction insights
            if (predictionData.chartData && predictionData.chartData.length > 0) {
                const chartData = predictionData.chartData;

                // Find peak and low prediction dates
                const predictedData = chartData.filter((d: any) => d.predicted != null && d.predicted > 0);
                if (predictedData.length > 0) {
                    const sortedByPredicted = [...predictedData].sort((a: any, b: any) => (b.predicted || 0) - (a.predicted || 0));
                    const peakDay = sortedByPredicted[0];
                    const lowDay = sortedByPredicted[sortedByPredicted.length - 1];

                    // Calculate totals and averages
                    const totalPredicted = predictedData.reduce((sum: number, d: any) => sum + (d.predicted || 0), 0);
                    const avgPredicted = Math.round(totalPredicted / predictedData.length);

                    // Find holiday dates
                    const holidayDates = chartData.filter((d: any) => d.isHoliday).map((d: any) => `${d.date} (${d.holidayName || 'Hari Libur'})`);

                    // Format currency helper
                    const formatRupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

                    contextInfo += `

=== RINGKASAN PREDIKSI PENJUALAN (dalam Rupiah) ===
Periode Prediksi: ${predictedData.length} hari
Tanggal Prediksi Tertinggi: ${peakDay.date} dengan estimasi penjualan ${formatRupiah(Math.round(peakDay.predicted))}
Tanggal Prediksi Terendah: ${lowDay.date} dengan estimasi penjualan ${formatRupiah(Math.round(lowDay.predicted))}
Total Prediksi Penjualan: ${formatRupiah(Math.round(totalPredicted))}
Rata-rata Penjualan Harian: ${formatRupiah(avgPredicted)}
${holidayDates.length > 0 ? `Hari Libur dalam Periode: ${holidayDates.slice(0, 5).join(', ')}${holidayDates.length > 5 ? ` dan ${holidayDates.length - 5} lainnya` : ''}` : 'Tidak ada hari libur dalam periode prediksi'}

CATATAN PENTING: Nilai prediksi adalah dalam RUPIAH (pendapatan/penjualan), BUKAN dalam unit/jumlah barang.
=== AKHIR RINGKASAN PREDIKSI ===
`;
                }
            }

            // Process event annotations with impact explanations
            if (predictionData.eventAnnotations && predictionData.eventAnnotations.length > 0) {
                const eventList = predictionData.eventAnnotations
                    .slice(0, 15)
                    .map((e: any) => {
                        const types = e.types || [];
                        let impactExplanation = '';

                        // Explain impact based on event type
                        if (types.includes('store-closed')) {
                            impactExplanation = ' → Prediksi SANGAT RENDAH karena toko tutup';
                        } else if (types.includes('holiday')) {
                            impactExplanation = ' → Biasanya penjualan TURUN karena hari libur nasional (banyak orang berkumpul di rumah)';
                        } else if (types.includes('promotion')) {
                            impactExplanation = ' → Prediksi NAIK karena ada promosi/diskon';
                        } else if (types.includes('event')) {
                            impactExplanation = ' → Bisa berdampak pada penjualan tergantung jenis acara';
                        }

                        return `- ${e.date}: ${e.titles.join(', ')} (${types.join(', ')})${impactExplanation}`;
                    })
                    .join('\n');

                contextInfo += `

=== EVENT/ACARA DAN DAMPAKNYA TERHADAP PREDIKSI ===
Berikut adalah event yang mempengaruhi prediksi penjualan:
${eventList}

PENJELASAN DAMPAK EVENT:
- HARI LIBUR NASIONAL (seperti Natal, Lebaran, Tahun Baru): Biasanya penjualan cenderung TURUN karena banyak orang merayakan di rumah atau berkumpul dengan keluarga, sehingga traffic ke toko berkurang.
- PROMOSI/DISKON: Penjualan biasanya NAIK karena ada daya tarik harga khusus.
- TOKO TUTUP: Prediksi akan SANGAT RENDAH atau NOL karena tidak ada operasional.
- EVENT UMUM: Dampak bervariasi tergantung jenis acara.
=== AKHIR DATA EVENT ===
`;
            }

            // Process metadata
            if (predictionData.meta) {
                const meta = predictionData.meta;
                const accuracyInfo = meta.accuracy != null ? `${meta.accuracy}%` : 'N/A';
                const growthFactor = meta.applied_factor != null ? `${((meta.applied_factor - 1) * 100).toFixed(1)}%` : 'N/A';
                const forecastDays = meta.forecastDays || 'N/A';

                let freshnessInfo = '';
                if (meta.data_freshness) {
                    freshnessInfo = `Status Data: ${meta.data_freshness.status}, ${meta.data_freshness.days_since_last_data || '?'} hari sejak data terakhir`;
                }

                contextInfo += `

=== INFORMASI MODEL PREDIKSI ===
Akurasi Model: ${accuracyInfo}
Faktor Pertumbuhan: ${growthFactor}
Jumlah Hari Prediksi: ${forecastDays}
${freshnessInfo}
${meta.warning ? `Peringatan: ${meta.warning}` : ''}
=== AKHIR INFORMASI MODEL ===
`;
            }

            if (!hasRecommendations) {
                contextInfo += `
CATATAN: Tidak ada data rekomendasi restock spesifik, namun data prediksi penjualan tersedia untuk analisis.`;
            }
        } else {
            // No prediction data available
            contextInfo = `
CATATAN: Saat ini tidak ada data prediksi yang tersedia. Jika user bertanya tentang prediksi atau restock, minta mereka untuk menjalankan prediksi terlebih dahulu di halaman Smart Prediction.`;
        }

        const systemPrompt = `Kamu adalah asisten AI cerdas untuk sistem manajemen inventaris SIPREMS.
Tugasmu membantu user mengelola stok dan memahami prediksi permintaan dengan gaya profesional, ramah, dan informatif.
${contextInfo}

KEMAMPUAN INSIGHT PREDIKSI:
Kamu memiliki akses ke data prediksi lengkap yang mencakup:
1. REKOMENDASI RESTOCK - Daftar produk yang perlu di-restock beserta urgensinya
2. RINGKASAN PREDIKSI PENJUALAN - Tanggal puncak/terendah penjualan, total dan rata-rata prediksi
3. EVENT/ACARA - Hari libur dan event yang mempengaruhi prediksi
4. INFORMASI MODEL - Akurasi prediksi dan faktor pertumbuhan

CONTOH PERTANYAAN YANG BISA DIJAWAB:
- "Kapan prediksi penjualan tertinggi?" -> Gunakan data RINGKASAN PREDIKSI
- "Apa dampak hari libur terhadap penjualan?" -> Gunakan data EVENT dan hari libur dalam RINGKASAN
- "Bagaimana tren penjualan bulan depan?" -> Gunakan rata-rata dan total prediksi
- "Berapa akurasi prediksi saat ini?" -> Gunakan INFORMASI MODEL
- "Produk apa yang perlu di-restock?" -> Gunakan DATA REKOMENDASI RESTOCK

ATURAN KRITIS (WAJIB DIIKUTI):
- HANYA gunakan nama produk yang ada dalam DATA REKOMENDASI RESTOCK
- JANGAN PERNAH mengarang atau menyebutkan nama produk yang tidak ada dalam data
- Jika tidak ada data, katakan dengan jelas bahwa user perlu menjalankan prediksi terlebih dahulu
- Semua informasi stok, prediksi, dan rekomendasi HARUS diambil dari data yang diberikan
- Untuk pertanyaan tentang tren/insight, gunakan RINGKASAN PREDIKSI dan INFORMASI MODEL

ATURAN GAYA PENULISAN:
- Gunakan bahasa Indonesia yang natural dan profesional
- JANGAN gunakan simbol markdown seperti ** atau ## atau - atau * untuk formatting
- Tulis dalam paragraf yang mengalir natural, bukan list dengan bullet points
- Jika perlu menyebutkan beberapa item, gunakan angka (1, 2, 3) dengan kalimat lengkap
- Jawab langsung dan to-the-point
- Gunakan emoji secukupnya untuk membuat respons lebih friendly (maksimal 2 per respons)

CONTOH RESPONS YANG BENAR:
1. Tentang restock: "Berdasarkan data rekomendasi sistem, ada beberapa produk yang perlu diperhatikan. Pertama adalah Coconut Latte dengan stok 113 unit dan prediksi kebutuhan 657 unit."
2. Tentang prediksi penjualan: "Prediksi penjualan tertinggi diperkirakan pada tanggal 5 Januari dengan estimasi Rp 25.000.000. Sementara tanggal 25 Desember diprediksi lebih rendah sekitar Rp 21.000.000 karena bertepatan dengan hari Natal di mana banyak orang merayakan di rumah. 📉"
3. Tentang tren: "Berdasarkan data prediksi untuk 30 hari ke depan, rata-rata penjualan harian diperkirakan sekitar Rp 22.000.000 dengan total prediksi Rp 660.000.000."
4. Tentang mengapa prediksi turun: "Prediksi penjualan pada tanggal tersebut lebih rendah karena bertepatan dengan hari libur nasional. Berdasarkan data historis, saat hari libur besar seperti Natal atau Lebaran, traffic ke toko cenderung berkurang karena masyarakat merayakan di rumah bersama keluarga."

Jika user meminta untuk melakukan restock produk, berikan respons dalam format JSON dengan action.
Jika bukan permintaan aksi, berikan respons normal saja.

Format respons untuk perintah aksi:
{
  "response": "pesan balasan untuk user",
  "action": {
    "type": "restock" | "bulk_restock" | "none",
    "productId": "id produk jika single restock",
    "productName": "nama produk",
    "quantity": jumlah restock,
    "needsConfirmation": true
  }
}

Format respons normal (tanpa aksi):
{
  "response": "pesan balasan untuk user",
  "action": { "type": "none", "needsConfirmation": false }
}`;

        const messages = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...chatHistory.map((msg) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            })),
            { role: 'user', parts: [{ text: message }] },
        ];

        try {
            const chat = this.model.startChat({
                history: messages.slice(0, -1) as any,
            });

            const result = await chat.sendMessage(message);
            let responseText = result.response.text().trim();

            // Try to parse as JSON
            try {
                // Clean up markdown code blocks if present
                let cleanedText = responseText;

                // Remove markdown code block wrappers (```json ... ``` or ``` ... ```)
                if (cleanedText.includes('```')) {
                    // Match code block: ```json or ``` at start, ``` at end
                    cleanedText = cleanedText
                        .replace(/^```(?:json)?\s*/i, '')  // Remove opening ```json or ```
                        .replace(/\s*```$/i, '')            // Remove closing ```
                        .trim();
                }

                const parsed = JSON.parse(cleanedText);

                return {
                    response: parsed.response || responseText,
                    action: parsed.action || { type: 'none', needsConfirmation: false },
                };
            } catch (parseError) {
                // Plain text response
                // Not JSON, return as plain text response
                return {
                    response: responseText,
                    action: { type: 'none', needsConfirmation: false },
                };
            }
        } catch (error) {
            console.error('[Gemini] Chat error:', error);
            return {
                response: 'Maaf, terjadi kesalahan saat memproses permintaan. Silakan coba lagi.',
                action: { type: 'none', needsConfirmation: false },
            };
        }
    }
}

export const geminiService = new GeminiService();
