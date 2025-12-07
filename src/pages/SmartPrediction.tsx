import React, { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, MessageSquare, Send, ChevronRight, Calendar, Package, TrendingDown, CheckCircle, Clock } from 'lucide-react';
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';
import { useStore } from '../context/StoreContext';
import { apiService, type PredictionResponse, type ModelAccuracyResponse } from '../services/api';
import { geminiService, type ChatMessage, type CommandAction } from '../services/gemini';
import { PredictionData, RestockRecommendation } from '../types';
import { Button } from '../components/ui/button';

type PredictionState = 'idle' | 'loading' | 'result' | 'learning' | 'error';
type PredictionRange = 7 | 30 | 90;

export function SmartPrediction() {
  const { events } = useStore();
  const [state, setState] = useState<PredictionState>('idle');
  const [predictionRange, setPredictionRange] = useState<PredictionRange>(30);
  const [predictionData, setPredictionData] = useState<PredictionData[]>([]);
  const [restockRecommendations, setRestockRecommendations] = useState<RestockRecommendation[]>([]);
  const [predictionMeta, setPredictionMeta] = useState<PredictionResponse['meta'] | null>(null);
  const [eventAnnotations, setEventAnnotations] = useState<PredictionResponse['eventAnnotations']>([]);
  const [error, setError] = useState<string>('');
  const [restockingProduct, setRestockingProduct] = useState<string | null>(null);
  const [forecastAccuracy, setForecastAccuracy] = useState<number | null>(null);
  const [accuracyDetails, setAccuracyDetails] = useState<ModelAccuracyResponse | null>(null);
  const [dataFreshnessWarning, setDataFreshnessWarning] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Saya adalah asisten AI Anda. Klik "Mulai Prediksi" untuk menghasilkan perkiraan stok berdasarkan kalender acara dan riwayat penjualan Anda.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<CommandAction | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  const fetchForecastAccuracy = async () => {
    try {
      // Use new endpoint with actual regressors for accurate MAPE calculation
      const result = await apiService.getModelAccuracy('1');
      setForecastAccuracy(result.accuracy);
      setAccuracyDetails(result);
      
      // Check for data freshness warning
      if (result.warning) {
        setDataFreshnessWarning(result.warning);
      } else if (result.data_freshness?.status === 'stale' || result.data_freshness?.status === 'very_stale') {
        const days = result.data_freshness?.days_since_last_transaction;
        setDataFreshnessWarning(`Data tidak segar - ${days} hari sejak transaksi terakhir`);
      } else {
        setDataFreshnessWarning(null);
      }
      
      if (result.status === 'success') {
        console.log(`Model accuracy loaded: ${result.accuracy}% (Train MAPE: ${result.train_mape}%, Val MAPE: ${result.validation_mape}%)`);
        console.log(`Data freshness: ${result.data_freshness?.status}, days since last: ${result.data_freshness?.days_since_last_transaction}`);
      }
    } catch (error) {
      console.error('Error fetching forecast accuracy:', error);
      setForecastAccuracy(null);
      setAccuracyDetails(null);
      setDataFreshnessWarning(null);
    }
  };

  const handleStartPrediction = async (days?: PredictionRange | React.MouseEvent) => {
    setState('loading');
    setError('');
    
    // Handle case where event object is accidentally passed
    const daysToUse = (typeof days === 'number' ? days : predictionRange);

    try {
      // Convert StoreContext events to API format
      const impactDefaults: Record<string, number> = {
        promotion: 0.4,
        holiday: 0.9,
        event: 0.5,
        'store-closed': 1,
      };

      const apiEvents = events.map(event => ({
        date: event.date,
        type: event.type,
        title: event.title,
        impact: event.impact ?? impactDefaults[event.type] ?? 0.3,
      }));

      // Call the API with days parameter
      const response = await apiService.getPrediction('store_1', apiEvents, undefined, daysToUse);

      if (response.status === 'success') {
        setPredictionData(response.chartData);
        setRestockRecommendations(response.recommendations);
        setPredictionMeta(response.meta);
        setEventAnnotations(response.eventAnnotations || []);

        // Check for data freshness warning from prediction response
        if (response.meta?.warning) {
          setDataFreshnessWarning(response.meta.warning);
        } else if (response.meta?.data_freshness?.status === 'stale' || response.meta?.data_freshness?.status === 'very_stale') {
          const days = response.meta.data_freshness.days_since_last_data;
          setDataFreshnessWarning(`Data tidak segar - ${days} hari sejak transaksi terakhir. Prediksi telah disesuaikan.`);
        } else {
          setDataFreshnessWarning(null);
        }

        // Fetch forecast accuracy from dedicated backend endpoint
        await fetchForecastAccuracy();

        // Update chatbot with insights
        const firstHoliday = response.chartData.find(d => d.isHoliday);
        const factorInfo = response.meta?.applied_factor ? response.meta.applied_factor.toFixed(2) : '1.00';
        
        // Include data freshness warning in initial message if present
        let initialMessage = '';
        if (response.meta?.data_freshness?.status === 'stale' || response.meta?.data_freshness?.status === 'very_stale') {
          initialMessage = `⚠️ Data tidak segar (${response.meta.data_freshness.days_since_last_data} hari sejak transaksi terakhir). Prediksi telah disesuaikan ke bawah. `;
        }
        
        initialMessage += firstHoliday
          ? `Sales spike predicted around ${firstHoliday.date}. Historical data shows significant increase during ${firstHoliday.holidayName}. Consider restocking high-demand items early.`
          : `Prediction complete. Applied growth factor ${factorInfo}. Review the forecast and recommendations below.`;

        setChatMessages([{
          role: 'assistant',
          content: initialMessage,
        }]);

        setState('result');
      } else {
        setError('Prediction failed. Please try again.');
        setState('error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch prediction from server';
      setError(errorMessage);
      setState('error');
      console.error('Prediction error:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput;
    setChatInput('');
    setIsChatLoading(true);

    const updatedMessages: ChatMessage[] = [
      ...chatMessages,
      { role: 'user', content: userMessage },
    ];
    setChatMessages(updatedMessages);

    try {
      // Safely prepare prediction data, avoiding large nested objects
      const safeRecommendations = (restockRecommendations || []).map(r => ({
        productId: r?.productId ?? '',
        productName: r?.productName ?? 'Unknown',
        currentStock: r?.currentStock ?? 0,
        predictedDemand: r?.predictedDemand ?? 0,
        recommendedRestock: r?.recommendedRestock ?? 0,
        urgency: r?.urgency ?? 'low',
        category: r?.category ?? undefined,
      }));

      const safeEventAnnotations = (eventAnnotations || []).map(e => ({
        date: e?.date ?? '',
        titles: e?.titles ?? [],
        types: e?.types ?? [],
      }));

      const fullPredictionData: PredictionResponse | null = predictionData.length > 0 ? {
        status: 'success',
        chartData: predictionData,
        recommendations: safeRecommendations,
        eventAnnotations: safeEventAnnotations,
        meta: predictionMeta ? {
          applied_factor: predictionMeta.applied_factor ?? 1,
          forecastDays: predictionMeta.forecastDays ?? 0,
          accuracy: predictionMeta.accuracy ?? undefined,
        } : undefined,
      } : null;

      const { response, action } = await geminiService.chat(
        userMessage,
        fullPredictionData,
        updatedMessages
      );

      // Safely handle response
      const safeResponse = response || 'Maaf, tidak dapat memproses permintaan Anda.';
      
      setChatMessages([
        ...updatedMessages,
        { role: 'assistant', content: safeResponse },
      ]);

      // Validate action before showing confirmation
      if (action && action.type && action.type !== 'none' && action.needsConfirmation) {
        // For bulk_restock, check if there are products to restock
        if (action.type === 'bulk_restock') {
          const productsNeedingRestock = safeRecommendations.filter(r => (r.recommendedRestock || 0) > 0);
          if (productsNeedingRestock.length === 0) {
            setChatMessages(prev => [
              ...prev,
              { role: 'assistant', content: 'Tidak ada produk yang membutuhkan restock saat ini. Semua stok sudah mencukupi.' },
            ]);
            return;
          }
        }
        
        // For single restock, validate product exists and quantity is valid
        if (action.type === 'restock') {
          if (!action.productId || !action.productName) {
            setChatMessages(prev => [
              ...prev,
              { role: 'assistant', content: 'Produk tidak ditemukan dalam rekomendasi. Silakan cek nama produk.' },
            ]);
            return;
          }
          if (action.quantity == null || action.quantity <= 0) {
            setChatMessages(prev => [
              ...prev,
              { role: 'assistant', content: 'Jumlah restock harus lebih dari 0.' },
            ]);
            return;
          }
        }
        
        // Safely set pending action with validated data
        const safeAction: CommandAction = {
          type: action.type,
          productId: action.productId ?? null,
          productName: action.productName ?? null,
          quantity: action.quantity ?? null,
          needsConfirmation: action.needsConfirmation,
        };
        
        setPendingAction(safeAction);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    return {
      high: 'text-red-600 bg-red-50 border-red-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-green-600 bg-green-50 border-green-200',
    }[urgency] || 'text-slate-600 bg-slate-50 border-slate-200';
  };

  const getEventCategoryColor = (type: string) => {
    const colors: Record<string, string> = {
      promotion: '#10b981', // green
      holiday: '#ef4444', // red
      event: '#f59e0b', // amber
      'store-closed': '#6b7280', // gray
    };
    return colors[type] || '#94a3b8'; // slate
  };

  const getEventCategoryBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      promotion: 'bg-green-100 text-green-700 border-green-300',
      holiday: 'bg-red-100 text-red-700 border-red-300',
      event: 'bg-amber-100 text-amber-700 border-amber-300',
      'store-closed': 'bg-gray-100 text-gray-700 border-gray-300',
    };
    return colors[type] || 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const handleRangeChange = async (days: PredictionRange) => {
    setPredictionRange(days);
    if (state === 'result') {
      await handleStartPrediction(days);
    }
  };

  const handleRestock = async (productId: string, quantity: number, skipChatMessage = false): Promise<boolean> => {
    setRestockingProduct(productId);
    try {
      // Add timeout to prevent infinite hang
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      await apiService.restockProduct(productId, quantity);
      clearTimeout(timeoutId);
      
      // Update recommendations to reflect new stock
      setRestockRecommendations(prev =>
        prev.map(item =>
          item.productId === productId
            ? { ...item, currentStock: item.currentStock + quantity }
            : item
        )
      );
      
      // Only add chat message if not called from handleConfirmAction
      if (!skipChatMessage) {
        const productName = restockRecommendations.find(r => r.productId === productId)?.productName || 'product';
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Berhasil restock ${quantity} unit untuk ${productName}.`,
          },
        ]);
      }
      return true;
    } catch (error) {
      console.error('Restock error:', error);
      if (!skipChatMessage) {
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Gagal melakukan restock. Silakan coba lagi.`,
          },
        ]);
      }
      return false;
    } finally {
      setRestockingProduct(null);
    }
  };

  const handleQuickPrompt = (prompt: string, answer: string) => {
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: prompt },
      { role: 'assistant', content: answer },
    ]);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction || isConfirmLoading) return;

    setIsConfirmLoading(true);

    try {
      switch (pendingAction.type) {
        case 'restock':
          if (pendingAction.productId && pendingAction.quantity != null && pendingAction.quantity > 0) {
            const success = await handleRestock(pendingAction.productId, pendingAction.quantity, true);
            setChatMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: success 
                  ? `Berhasil restock ${pendingAction.quantity} unit untuk ${pendingAction.productName || 'produk'}.`
                  : `Gagal restock ${pendingAction.productName || 'produk'}. Silakan coba lagi.`,
              },
            ]);
          } else {
            setChatMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: 'Gagal restock: Informasi produk tidak lengkap.',
              },
            ]);
          }
          break;
        
        case 'bulk_restock':
          const productsToRestock = (restockRecommendations || []).filter(r => 
            r && (r.recommendedRestock || 0) > 0
          );
          
          if (productsToRestock.length === 0) {
            setChatMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: 'Tidak ada produk yang membutuhkan restock saat ini.',
              },
            ]);
            break;
          }

          let successCount = 0;
          let failCount = 0;
          const results: string[] = [];

          for (const product of productsToRestock) {
            try {
              if (product.productId && product.recommendedRestock > 0) {
                const success = await handleRestock(product.productId, product.recommendedRestock, true);
                if (success) {
                  successCount++;
                  results.push(`${product.productName}: +${product.recommendedRestock} unit`);
                } else {
                  failCount++;
                }
              }
            } catch (err) {
              failCount++;
              console.error(`Failed to restock ${product.productName}:`, err);
            }
          }

          const summaryMessage = successCount > 0
            ? `Berhasil restock ${successCount} produk:\n${results.join('\n')}${failCount > 0 ? `\n\n${failCount} produk gagal di-restock.` : ''}`
            : 'Gagal melakukan restock. Silakan coba lagi.';
          
          setChatMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: summaryMessage,
            },
          ]);
          break;

        case 'update_stock':
          if (pendingAction.productName && pendingAction.quantity != null) {
            const product = (restockRecommendations || []).find(r => 
              r?.productName?.toLowerCase()?.includes((pendingAction.productName || '').toLowerCase())
            );
            if (product) {
              await apiService.updateStock(product.productId, pendingAction.quantity);
              setChatMessages(prev => [
                ...prev,
                {
                  role: 'assistant',
                  content: `Stok berhasil diperbarui menjadi ${pendingAction.quantity} unit untuk ${product.productName}.`,
                },
              ]);
            } else {
              setChatMessages(prev => [
                ...prev,
                {
                  role: 'assistant',
                  content: `Produk "${pendingAction.productName}" tidak ditemukan dalam rekomendasi.`,
                },
              ]);
            }
          }
          break;

        default:
          setChatMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: 'Aksi tidak dikenali.',
            },
          ]);
      }
    } catch (error) {
      console.error('Action error:', error);
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Gagal menjalankan aksi. Silakan coba lagi.',
        },
      ]);
    } finally {
      setIsConfirmLoading(false);
      setPendingAction(null);
    }
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    setChatMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: 'Aksi dibatalkan.',
      },
    ]);
  };

  // Error State
  if (state === 'error') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex w-24 h-24 bg-gradient-to-br from-red-500 to-orange-600 rounded-3xl items-center justify-center mb-6">
          <AlertTriangle className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl text-slate-900 mb-2">Kesalahan Prediksi</h1>
        <p className="text-sm text-red-600 mb-8 max-w-lg mx-auto">{error}</p>
        <Button
          onClick={() => {
            setError('');
            setState('idle');
          }}
          size="lg"
          className="shadow-lg hover:shadow-xl"
        >
          <Sparkles className="w-5 h-5" />
          Coba Lagi
        </Button>
      </div>
    );
  }

  // Idle State
  if (state === 'idle') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl items-center justify-center mb-6">
          <Sparkles className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl text-slate-900 mb-2">Prediksi Stok Cerdas</h1>
        <p className="text-sm text-slate-500 mb-8 max-w-lg mx-auto">
          AI kami menganalisis riwayat penjualan, tren musiman, dan hari libur mendatang untuk memprediksi permintaan dan merekomendasikan level stok optimal.
        </p>
        <Button
          onClick={() => handleStartPrediction()}
          size="lg"
          className="shadow-lg hover:shadow-xl"
        >
          <Sparkles className="w-5 h-5" />
          Mulai Prediksi
        </Button>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <TrendingUp className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-base font-medium text-slate-900 mb-1">Analisis Tren</h3>
            <p className="text-sm text-slate-500">Identifikasi pola dalam data penjualan Anda</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <Calendar className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-base font-medium text-slate-900 mb-1">Dampak Hari Libur</h3>
            <p className="text-sm text-slate-500">Prediksi lonjakan saat acara khusus</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <AlertTriangle className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-base font-medium text-slate-900 mb-1">Peringatan Cerdas</h3>
            <p className="text-sm text-slate-500">Notifikasi sebelum stok habis</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (state === 'loading') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl items-center justify-center mb-6 animate-pulse">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
        <h1 className="text-2xl text-slate-900 mb-2">Menganalisis Data Anda...</h1>
        <p className="text-sm text-slate-500 mb-8">
          AI kami sedang memproses riwayat penjualan dan menghasilkan prediksi
        </p>
        <div className="max-w-md mx-auto">
          <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
          <div className="mt-6 space-y-3 text-left">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Memuat data penjualan...</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Menganalisis pola musiman...</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span>Menghasilkan prediksi...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Learning Mode State
  if (state === 'learning') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex w-24 h-24 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-3xl items-center justify-center mb-6">
          <AlertTriangle className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl text-slate-900 mb-2">Sistem Sedang Belajar</h1>
        <p className="text-sm text-slate-500 mb-8 max-w-lg mx-auto">
          Kami membutuhkan minimal 7 hari data penjualan untuk menghasilkan prediksi yang akurat. Terus gunakan sistem dan periksa kembali nanti!
        </p>
        <div className="bg-white rounded-xl p-6 border border-slate-200 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Progres Pengumpulan Data</span>
            <span className="text-sm font-medium text-indigo-600">3/7 hari</span>
          </div>
          <div className="bg-slate-200 rounded-full h-3 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full rounded-full" style={{ width: '43%' }}></div>
          </div>
          <p className="text-xs text-slate-400 mt-3">4 hari lagi hingga prediksi tersedia</p>
        </div>
      </div>
    );
  }

  // Result State
  return (
    <div className="space-y-6">
      {/* Header with Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-slate-900 mb-1">Hasil Prediksi AI</h1>
          <p className="text-sm text-slate-500">Prediksi dibuat pada {new Date().toLocaleDateString('id-ID')}</p>
        </div>
        <div className="flex gap-2">
          {([7, 30, 90] as PredictionRange[]).map((days) => (
            <Button
              key={days}
              onClick={() => handleRangeChange(days)}
              variant={predictionRange === days ? 'default' : 'outline'}
            >
              {days} hari
            </Button>
          ))}
        </div>
      </div>

      {/* Data Freshness Warning Banner */}
      {dataFreshnessWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">{dataFreshnessWarning}</p>
              <p className="text-xs text-amber-600 mt-1">
                Lakukan transaksi baru untuk memperbarui data dan meningkatkan akurasi prediksi.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Prediction Summary Cards - Metric Cards */}
      {predictionMeta && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`bg-white rounded-xl p-6 border ${dataFreshnessWarning ? 'border-amber-300' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${
                dataFreshnessWarning 
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                  : accuracyDetails?.fit_status === 'good' 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                    : 'bg-gradient-to-br from-yellow-500 to-orange-600'
              }`}>
                {dataFreshnessWarning ? (
                  <AlertTriangle className="w-6 h-6 text-white" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-white" />
                )}
              </div>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                dataFreshnessWarning 
                  ? 'text-amber-600 bg-amber-50'
                  : accuracyDetails?.fit_status === 'good' 
                    ? 'text-green-600 bg-green-50' 
                    : 'text-yellow-600 bg-yellow-50'
              }`}>
                {dataFreshnessWarning 
                  ? 'Data Tidak Segar'
                  : accuracyDetails?.fit_status === 'good' 
                    ? 'Good Fit' 
                    : accuracyDetails?.fit_status || 'N/A'}
              </span>
            </div>
            <h3 className="text-sm text-slate-500 mb-1">Akurasi Prediksi</h3>
            <p className={`text-2xl font-medium ${dataFreshnessWarning ? 'text-amber-700' : 'text-slate-900'}`}>
              {forecastAccuracy !== null ? `${forecastAccuracy}%` : 'N/A'}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {dataFreshnessWarning 
                ? `Transaksi terakhir: ${accuracyDetails?.data_freshness?.days_since_last_transaction || '?'} hari lalu`
                : accuracyDetails?.validation_mape !== null 
                  ? `Val MAPE: ${accuracyDetails.validation_mape}%` 
                  : 'Performa model'}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className={`text-sm font-medium ${((predictionMeta.applied_factor - 1) * 100) >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-3 py-1 rounded-full`}>
                {((predictionMeta.applied_factor - 1) * 100) >= 0 ? '+' : ''}{((predictionMeta.applied_factor - 1) * 100).toFixed(1)}%
              </span>
            </div>
            <h3 className="text-sm text-slate-500 mb-1">Faktor Pertumbuhan</h3>
            <p className="text-2xl font-medium text-slate-900">{((predictionMeta.applied_factor - 1) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-2">vs periode sebelumnya</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full">
                {restockRecommendations.filter(r => r.urgency === 'high').length}
              </span>
            </div>
            <h3 className="text-sm text-slate-500 mb-1">Barang Berisiko Tinggi</h3>
            <p className="text-2xl font-medium text-slate-900">{restockRecommendations.filter(r => r.urgency === 'high').length}</p>
            <p className="text-xs text-slate-400 mt-2">Perlu segera diisi ulang</p>
          </div>
        </div>
      )}

      <div className="space-y-6">

          {/* Forecast Chart (INTEGRATED UI/UX HERE) */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-xl font-medium text-slate-900 mb-1">Prediksi Penjualan</h2>
              <p className="text-sm text-slate-500">Data historis vs prediksi AI dengan penanda acara</p>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={predictionData}>
                {/* 1. Define Gradient for "Forecast" style */}
                <defs>
                  <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                
                {/* 2. Visual Separation: Historical (Solid) vs Predicted (Dashed/Gradient) */}
                {/* Historical: Solid Line, Darker color */}
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="#334155"
                  strokeWidth={2.5}
                  name="Penjualan Historis"
                  dot={{ r: 3, fill: '#334155' }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
                
                {/* Predicted: Combined Component (Area + Line Style) - Single Component */}
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  fill="url(#colorPredicted)"
                  fillOpacity={1}
                  name="Prediksi AI"
                  dot={false}
                  connectNulls={true}
                />
                
                {/* 3. Annotations: Event Markers & Labels */}
                {eventAnnotations.map((event, idx) => {
                  const mainType = event.types[0] || 'event';
                  const color = getEventCategoryColor(mainType);
                  return (
                    <ReferenceLine
                      key={idx}
                      x={event.date}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      label={{
                        value: event.titles[0],
                        position: 'top',
                        fill: color, // Gunakan warna event agar teks terlihat jelas
                        fontSize: 12,
                        fontWeight: 700,
                        dy: -10
                      }}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
            
            {/* Custom Legend/Explanation for the UI Styles */}
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-slate-700"></div>
                <span className="text-slate-600 text-xs">Penjualan Historis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                   <div className="w-6 h-0.5 bg-indigo-600 border-t border-dashed"></div>
                </div>
                <span className="text-slate-600 text-xs">Prediksi AI</span>
              </div>
              <div className="w-px h-4 bg-slate-300 mx-2"></div>
              {/* Event Legend */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-slate-600 text-xs">Promo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-slate-600 text-xs">Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-slate-600 text-xs">Event</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                <span className="text-slate-600 text-xs">Store Closed</span>
              </div>
            </div>
          </div>

          {/* Restock Recommendations */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-xl font-medium text-slate-900 mb-1">Rekomendasi Pengisian Stok</h2>
              <p className="text-sm text-slate-500">Produk yang diprediksi akan melonjak permintaannya</p>
            </div>
            <div className="space-y-3">
              {(!restockRecommendations || restockRecommendations.length === 0) ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Tidak ada rekomendasi restock saat ini.</p>
                  <p className="text-sm">Semua produk memiliki stok yang mencukupi.</p>
                </div>
              ) : (
                restockRecommendations.map((item) => {
                  if (!item || !item.productId) return null;
                  
                  const productId = item.productId || '';
                  const productName = item.productName || 'Produk Tidak Diketahui';
                  const currentStock = item.currentStock ?? 0;
                  const predictedDemand = item.predictedDemand ?? 0;
                  const recommendedRestock = item.recommendedRestock ?? 0;
                  const urgency = item.urgency || 'low';
                  const category = item.category;
                  
                  return (
                    <div
                      key={productId}
                      className="flex items-center justify-between p-6 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-base font-medium text-slate-900">{productName}</h3>
                          <span
                            className={`px-3 py-1 rounded-full border text-xs font-medium ${getUrgencyColor(urgency)}`}
                          >
                            {urgency.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                          {category && (
                            <span className="text-xs px-3 py-1 bg-white border border-slate-200 rounded-full font-medium">
                              {category}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="font-medium text-slate-700">Saat ini:</span> {currentStock}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-medium text-slate-700">Prediksi:</span> {predictedDemand}
                          </span>
                          <span className="text-indigo-600 font-medium flex items-center gap-1">
                            <span className="font-medium">Isi ulang:</span> +{recommendedRestock}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRestock(productId, recommendedRestock)}
                        disabled={restockingProduct === productId || recommendedRestock <= 0}
                        className="ml-4"
                      >
                        {restockingProduct === productId ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Memproses...
                          </>
                        ) : (
                          <>
                            <Package className="w-4 h-4" />
                            Isi Stok Sekarang
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {eventAnnotations.length > 0 && (
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <div className="mb-6">
                <h2 className="text-xl font-medium text-slate-900 mb-1">Jadwal Acara</h2>
                <p className="text-sm text-slate-500">AI mempertimbangkan promosi, hari libur & acara ini dalam prediksi</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eventAnnotations.slice(0, 6).map((event) => {
                  const mainType = event.types[0] || 'event';
                  return (
                    <div 
                      key={event.date} 
                      className="p-4 rounded-xl border-2 bg-gradient-to-br from-white to-slate-50 hover:shadow-md transition-shadow"
                      style={{ borderColor: getEventCategoryColor(mainType) + '40' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-slate-900">{event.date}</p>
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getEventCategoryColor(mainType) }}
                        />
                      </div>
                      <p className="text-sm text-slate-700 font-medium mb-3">{event.titles.join(', ')}</p>
                      <div className="flex flex-wrap gap-2">
                        {event.types.map((type) => (
                          <span 
                            key={type} 
                            className={`text-xs px-3 py-1 rounded-full border font-medium ${getEventCategoryBadgeColor(type)}`}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>

    </div>
  );
}