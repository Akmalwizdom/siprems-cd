import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, MessageSquare, Send, ChevronRight, Calendar, Package, TrendingDown, CheckCircle, Clock } from 'lucide-react';
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { apiService, type PredictionResponse, type ModelAccuracyResponse } from '../services/api';
import { geminiService, type ChatMessage, type CommandAction } from '../services/gemini';
import { PredictionData, RestockRecommendation } from '../types';
import { Button } from '../components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { RestockModal } from '../components/prediction/RestockModal';
import { ChatBot } from '../components/prediction/ChatBot';
import { AdminOnly } from '../components/auth/RoleGuard';
import Loader from '../components/common/Loader';
import { PredictionChartSVG } from '../components/prediction/PredictionChartSVG';
import { ScrollArea } from '../components/ui/scrollarea';
import { usePrediction } from '../hooks';


type PredictionState = 'idle' | 'loading' | 'result' | 'learning' | 'error';
type PredictionRange = 7 | 30 | 90;

export function SmartPrediction() {
  const { events } = useStore();
  const { getAuthToken } = useAuth();
  const [predictionRange, setPredictionRange] = useState<PredictionRange>(30);
  
  // Use cached prediction hook
  const { cachedData, hasCachedData, isRunning, runPrediction, updateRecommendations, updateStockAfterRestock } = usePrediction(predictionRange);
  
  // Derive state from cache
  const [state, setState] = useState<PredictionState>('idle');
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
  
  // Restore cached data when available
  useEffect(() => {
    if (hasCachedData && cachedData) {
      setPredictionData(cachedData.predictionData);
      setRestockRecommendations(cachedData.restockRecommendations);
      setPredictionMeta(cachedData.predictionMeta);
      setEventAnnotations(cachedData.eventAnnotations);
      setDataFreshnessWarning(cachedData.dataFreshnessWarning);
      setForecastAccuracy(cachedData.forecastAccuracy);
      setAccuracyDetails(cachedData.accuracyDetails);
      setState('result');
    }
  }, [hasCachedData, cachedData, predictionRange]);
  
  // Restock Alert State
  const [restockAlert, setRestockAlert] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
    productName?: string;
  } | null>(null);
  
  // Restock Modal State
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedRestockProduct, setSelectedRestockProduct] = useState<RestockRecommendation | null>(null);


  const handleOpenRestockModal = (item: RestockRecommendation) => {
    setSelectedRestockProduct(item);
    setIsRestockModalOpen(true);
  };

  const handleCloseRestockModal = () => {
    setIsRestockModalOpen(false);
    setSelectedRestockProduct(null);
  };

  const handleConfirmRestock = async (quantity: number) => {
    if (selectedRestockProduct) {
      await handleRestock(selectedRestockProduct.productId, quantity);
      handleCloseRestockModal();
    }
  };

  const fetchForecastAccuracy = async () => {
    try {
      // Get auth token for authenticated API call
      const token = await getAuthToken();
      
      // Use new endpoint with actual regressors for accurate MAPE calculation
      const result = await apiService.getModelAccuracy('store_1', token || undefined);
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
    
    // Update prediction range if different
    if (typeof days === 'number' && days !== predictionRange) {
      setPredictionRange(days);
    }

    try {
      // Use the cached runPrediction hook
      const result = await runPrediction();
      
      if (result) {
        setPredictionData(result.predictionData);
        setRestockRecommendations(result.restockRecommendations);
        setPredictionMeta(result.predictionMeta);
        setEventAnnotations(result.eventAnnotations);
        setDataFreshnessWarning(result.dataFreshnessWarning);
        setForecastAccuracy(result.forecastAccuracy);
        setAccuracyDetails(result.accuracyDetails);

        // Update chatbot with insights
        const firstHoliday = result.predictionData?.find?.(d => d.isHoliday);
        const factorInfo = result.predictionMeta?.applied_factor ? result.predictionMeta.applied_factor.toFixed(2) : '1.00';
        
        let initialMessage = '';
        if (result.dataFreshnessWarning) {
          initialMessage = `⚠️ ${result.dataFreshnessWarning} `;
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
        meta: {
          applied_factor: predictionMeta?.applied_factor ?? 1,
          forecastDays: predictionMeta?.forecastDays ?? 0,
          accuracy: predictionMeta?.accuracy,
        },
      } as PredictionResponse : null;

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
    const productName = restockRecommendations.find(r => r.productId === productId)?.productName || 'Produk';
    
    try {
      // Add timeout to prevent infinite hang
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      await apiService.restockProduct(productId, quantity);
      clearTimeout(timeoutId);
      
      // Remove product from recommendations (no longer needs restocking)
      setRestockRecommendations(prev =>
        prev.filter(item => item.productId !== productId)
      );
      
      // Also update the cache
      updateRecommendations(productId);
      
      // Set state for in-page alert
      setRestockAlert({
        show: true,
        type: 'success',
        message: `Berhasil menambahkan ${quantity} unit ke stok`,
        productName,
      });
      
      // Auto-hide alert after 5 seconds
      setTimeout(() => setRestockAlert(null), 5000);
      
      // Only add chat message if not called from handleConfirmAction
      if (!skipChatMessage) {
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ Berhasil restock ${quantity} unit untuk ${productName}.`,
          },
        ]);
      }
      return true;
    } catch (error) {
      console.error('Restock error:', error);
      
      // Set state for in-page alert
      setRestockAlert({
        show: true,
        type: 'error',
        message: 'Gagal menyimpan ke database. Silakan coba lagi.',
        productName,
      });
      
      // Auto-hide alert after 5 seconds
      setTimeout(() => setRestockAlert(null), 5000);
      
      if (!skipChatMessage) {
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `❌ Gagal melakukan restock untuk ${productName}. Silakan coba lagi.`,
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
      <div className="max-w-2xl mx-auto text-center py-12 lg:py-20">
        <div className="inline-flex w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl items-center justify-center mb-6">
          <Sparkles className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl text-slate-900 mb-2">Prediksi Stok Cerdas</h1>
        <p className="text-sm text-slate-500 mb-8 max-w-lg mx-auto">
          AI kami menganalisis riwayat penjualan, tren musiman, dan hari libur mendatang untuk memprediksi permintaan dan merekomendasikan level stok optimal.
        </p>
        
        {/* Quick Action Buttons - Admin Only */}
        <AdminOnly>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Button
              onClick={() => handleStartPrediction(7)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Prediksi 7 Hari
            </Button>
            <Button
              onClick={() => handleStartPrediction(30)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              <Sparkles className="w-4 h-4" />
              Prediksi 30 Hari
            </Button>
            <Button
              onClick={() => handleStartPrediction(90)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Prediksi 90 Hari
            </Button>
          </div>
        </AdminOnly>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left" style={{ marginTop: '2rem', gap: '1rem' }}>
          <div className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer" style={{ padding: '1.5rem' }} onClick={() => handleStartPrediction(30)}>
            <TrendingUp className="w-8 h-8 text-indigo-600" style={{ marginBottom: '0.75rem' }} />
            <h3 className="text-base font-medium text-slate-900" style={{ marginBottom: '0.25rem' }}>Analisis Tren</h3>
            <p className="text-sm text-slate-500">Identifikasi pola dalam data penjualan Anda</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer" style={{ padding: '1.5rem' }} onClick={() => handleStartPrediction(30)}>
            <Calendar className="w-8 h-8 text-indigo-600" style={{ marginBottom: '0.75rem' }} />
            <h3 className="text-base font-medium text-slate-900" style={{ marginBottom: '0.25rem' }}>Dampak Hari Libur</h3>
            <p className="text-sm text-slate-500">Prediksi lonjakan saat acara khusus</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer" style={{ padding: '1.5rem' }} onClick={() => handleStartPrediction(30)}>
            <AlertTriangle className="w-8 h-8 text-indigo-600" style={{ marginBottom: '0.75rem' }} />
            <h3 className="text-base font-medium text-slate-900" style={{ marginBottom: '0.25rem' }}>Peringatan Cerdas</h3>
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
        <div className="flex justify-center mb-6">
          <Loader />
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
              <div className="p-3 rounded-lg" style={{ backgroundColor: dataFreshnessWarning ? '#F59E0B' : accuracyDetails?.fit_status === 'good' ? '#10B981' : '#EAB308' }}>
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

          {(() => {
            const appliedFactor = predictionMeta.applied_factor;
            const isValidFactor = appliedFactor != null && !isNaN(appliedFactor) && isFinite(appliedFactor);
            const growthPercentage = isValidFactor ? ((appliedFactor - 1) * 100) : 0;
            const isPositive = growthPercentage >= 0;
            
            return (
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: '#6366F1' }}>
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <span className={`text-sm font-medium ${isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} px-3 py-1 rounded-full`}>
                    {isValidFactor ? `${isPositive ? '+' : ''}${growthPercentage.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <h3 className="text-sm text-slate-500 mb-1">Faktor Pertumbuhan</h3>
                <p className="text-2xl font-medium text-slate-900">
                  {isValidFactor ? `${growthPercentage.toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-xs text-slate-400 mt-2">vs periode sebelumnya</p>
              </div>
            );
          })()}

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#EF4444' }}>
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
      {/* Forecast Chart (Custom SVG) */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <PredictionChartSVG 
          data={predictionData}
          eventAnnotations={eventAnnotations}
          title="Prediksi Penjualan"
        />
      </div>

        {/* Two-column layout for Recommendations and Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Restock Recommendations */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col h-[600px]">
            <div className="mb-6 flex-shrink-0">
              <h2 className="text-xl font-medium text-slate-900 mb-1">Rekomendasi Pengisian Stok</h2>
              <p className="text-sm text-slate-500">Produk yang diprediksi akan melonjak permintaannya</p>
            </div>
            
            {/* Restock Alert */}
            {restockAlert && restockAlert.show && (
              <Alert 
                variant={restockAlert.type === 'success' ? 'success' : 'destructive'}
                className="mb-4 flex-shrink-0"
              >
                {restockAlert.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {restockAlert.type === 'success' ? 'Berhasil!' : 'Gagal!'}
                </AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    {restockAlert.productName && (
                      <strong>{restockAlert.productName}: </strong>
                    )}
                    {restockAlert.message}
                  </span>
                  <button 
                    onClick={() => setRestockAlert(null)}
                    className="ml-4 text-sm underline hover:no-underline"
                  >
                    Tutup
                  </button>
                </AlertDescription>
              </Alert>
            )}
            
            <ScrollArea className="flex-1 -mr-2 pr-4">
              <div className="space-y-3 pb-4">
                {(!restockRecommendations || restockRecommendations.length === 0) ? (
                  <div className="text-center py-12 text-slate-500">
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
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors gap-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-medium text-slate-900">{productName}</h3>
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${getUrgencyColor(urgency)}`}
                            >
                              {urgency.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                            {category && (
                              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full font-medium">
                                {category}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span className="font-medium text-slate-700">Stok:</span> {currentStock}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="font-medium text-slate-700">Prediksi:</span> {predictedDemand}
                            </span>
                            <span className="text-indigo-600 font-medium flex items-center gap-1">
                              <span>+ {recommendedRestock}</span>
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleOpenRestockModal(item)}
                          disabled={restockingProduct === productId || recommendedRestock <= 0}
                          size="sm"
                          className="flex-shrink-0"
                        >
                          {restockingProduct === productId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Package className="w-4 h-4 mr-2" />
                              Isi Stok
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Event Details */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col h-[600px]">
             <div className="mb-6 flex-shrink-0">
              <h2 className="text-xl font-medium text-slate-900 mb-1">Keterangan Event</h2>
              <p className="text-sm text-slate-500">Mendatang sesuai kalender Anda</p>
            </div>

            <ScrollArea className="flex-1 -mr-2 pr-4">
              <div className="grid grid-cols-1 gap-3 pb-4">
                {events && events.length > 0 ? (
                  events
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((event, index) => {
                      const eventLabelMapping: Record<string, string> = {
                        promotion: "Promo dadakan durasi pendek",
                        holiday: "Hari libur nasional",
                        event: "Event khusus",
                        "store-closed": "Toko Tutup",
                      };
                      
                      return (
                        <div 
                          key={event.id || index}
                          className="flex items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all group"
                          style={{ borderLeftWidth: '4px', borderLeftColor: getEventCategoryColor(event.type) }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {/* Colored dot indicator */}
                              <span 
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getEventCategoryColor(event.type) }}
                              />
                              <h3 className="text-sm font-semibold text-slate-900 truncate">
                                {event.title}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5 ml-4">
                              {eventLabelMapping[event.type] || "Informasi event"}
                            </p>
                          </div>
                          <div className="ml-4 text-sm font-medium text-indigo-600">
                            {new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Tidak ada event mendatang.</p>
                    <p className="text-sm">Tambahkan event di menu Kalender.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

      {/* Restock Modal */}
      <RestockModal
        isOpen={isRestockModalOpen}
        onClose={handleCloseRestockModal}
        onConfirm={handleConfirmRestock}
        product={selectedRestockProduct}
        isLoading={restockingProduct !== null}
      />

      {/* ChatBot - Only shows after prediction is used */}
      {state === 'result' && (
        <ChatBot 
          predictionData={{
            status: 'success',
            chartData: predictionData,
            recommendations: restockRecommendations,
            eventAnnotations: eventAnnotations,
            meta: {
              applied_factor: predictionMeta?.applied_factor ?? 1,
              forecastDays: predictionMeta?.forecastDays ?? 0,
              accuracy: predictionMeta?.accuracy,
            },
          } as PredictionResponse}
          onRestockSuccess={(productId, quantity) => {
            // Update cache for persistence
            updateStockAfterRestock(productId, quantity);
            // Update local state for immediate UI update
            setRestockRecommendations(prev =>
              prev.map(item => {
                if (item.productId === productId) {
                  return {
                    ...item,
                    currentStock: item.currentStock + quantity,
                    recommendedRestock: Math.max(0, item.recommendedRestock - quantity),
                  };
                }
                return item;
              })
            );
          }}
        />
      )}
    </div>
  );
}
