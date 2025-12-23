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

            console.log(`[Gemini] Classified "${title}" as "${category}" (${confidence})`);

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

        if (predictionData && predictionData.recommendations && predictionData.recommendations.length > 0) {
            hasRecommendations = true;
            const recommendations = predictionData.recommendations
                .slice(0, 10)
                .map((r: any, idx: number) => `${idx + 1}. ${r.productName} (kategori: ${r.category || 'N/A'}) - stok saat ini: ${r.currentStock} unit, prediksi kebutuhan: ${r.predictedDemand} unit, rekomendasi restock: ${r.recommendedRestock} unit, urgensi: ${r.urgency}`)
                .join('\n');

            console.log('[Gemini] Recommendations data received:');
            console.log(recommendations);

            contextInfo = `

=== DATA REKOMENDASI RESTOCK AKTUAL DARI SISTEM ===
${recommendations}
=== AKHIR DATA ===

PENTING: Data di atas adalah satu-satunya produk yang valid. JANGAN mengarang atau menyebutkan produk lain yang tidak ada dalam daftar di atas.`;
        } else {
            console.log('[Gemini] No recommendations data received');
            contextInfo = `
CATATAN: Saat ini tidak ada data rekomendasi restock yang tersedia. Jika user bertanya tentang restock, minta mereka untuk menjalankan prediksi terlebih dahulu.`;
        }

        const systemPrompt = `Kamu adalah asisten AI cerdas untuk sistem manajemen inventaris SIPREMS.
Tugasmu membantu user mengelola stok dan memahami prediksi permintaan dengan gaya profesional, ramah, dan informatif.
${contextInfo}

ATURAN KRITIS (WAJIB DIIKUTI):
- HANYA gunakan nama produk yang ada dalam DATA REKOMENDASI RESTOCK di atas
- JANGAN PERNAH mengarang atau menyebutkan nama produk yang tidak ada dalam data
- Jika tidak ada data rekomendasi, katakan dengan jelas bahwa data belum tersedia
- Semua informasi stok, prediksi, dan rekomendasi HARUS diambil dari data yang diberikan

ATURAN GAYA PENULISAN:
- Gunakan bahasa Indonesia yang natural dan profesional
- JANGAN gunakan simbol markdown seperti ** atau ## atau - atau * untuk formatting
- Tulis dalam paragraf yang mengalir natural, bukan list dengan bullet points
- Jika perlu menyebutkan beberapa item, gunakan angka (1, 2, 3) dengan kalimat lengkap
- Jawab langsung dan to-the-point
- Gunakan emoji secukupnya untuk membuat respons lebih friendly (maksimal 2 per respons)

CONTOH RESPONS YANG BENAR (AMBIL DARI DATA YANG ADA):
"Berdasarkan data rekomendasi sistem, ada beberapa produk yang perlu diperhatikan. Pertama adalah Coconut Latte dengan stok 113 unit dan prediksi kebutuhan 657 unit, kemudian Sparkling Yuzu Ade dengan stok 116 unit. Saya sarankan untuk segera melakukan restock pada produk-produk tersebut."

CONTOH YANG SALAH (JANGAN SEPERTI INI - mengarang produk):
"Berikut adalah Kopi Espresso Blend dengan stok 15 kg..." <- SALAH karena mengarang nama produk

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

                console.log('[Gemini] Attempting to parse response:', cleanedText.substring(0, 200));

                const parsed = JSON.parse(cleanedText);
                console.log('[Gemini] Successfully parsed JSON, response:', parsed.response?.substring(0, 100));

                return {
                    response: parsed.response || responseText,
                    action: parsed.action || { type: 'none', needsConfirmation: false },
                };
            } catch (parseError) {
                console.log('[Gemini] Failed to parse as JSON, returning as plain text');
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
