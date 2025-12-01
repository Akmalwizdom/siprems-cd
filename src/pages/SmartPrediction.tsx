import React, { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, MessageSquare, Send, ChevronRight, Calendar, Package, TrendingDown, CheckCircle, Clock } from 'lucide-react';
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';
import { useStore } from '../context/StoreContext';
import { apiService, type PredictionResponse, type ModelAccuracyResponse } from '../services/api';
import { geminiService, type ChatMessage, type CommandAction } from '../services/gemini';
import { PredictionData, RestockRecommendation } from '../types';
import { Button } from '../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'I\'m your AI assistant. Click "Start Prediction" to generate stock forecasts based on your calendar events and sales history.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<CommandAction | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const fetchForecastAccuracy = async () => {
    try {
      // Use new endpoint with actual regressors for accurate MAPE calculation
      const result = await apiService.getModelAccuracy('1');
      setForecastAccuracy(result.accuracy);
      setAccuracyDetails(result);
      
      if (result.status === 'success') {
        console.log(`Model accuracy loaded: ${result.accuracy}% (Train MAPE: ${result.train_mape}%, Val MAPE: ${result.validation_mape}%)`);
      }
    } catch (error) {
      console.error('Error fetching forecast accuracy:', error);
      setForecastAccuracy(null);
      setAccuracyDetails(null);
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

        // Fetch forecast accuracy from dedicated backend endpoint
        await fetchForecastAccuracy();

        // Update chatbot with insights
        const firstHoliday = response.chartData.find(d => d.isHoliday);
        const factorInfo = response.meta?.applied_factor ? response.meta.applied_factor.toFixed(2) : '1.00';
        const initialMessage = firstHoliday
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
      const fullPredictionData: PredictionResponse | null = predictionData.length > 0 ? {
        status: 'success',
        chartData: predictionData,
        recommendations: restockRecommendations,
        eventAnnotations,
        meta: predictionMeta || undefined,
      } : null;

      const { response, action } = await geminiService.chat(
        userMessage,
        fullPredictionData,
        updatedMessages
      );

      setChatMessages([
        ...updatedMessages,
        { role: 'assistant', content: response },
      ]);

      if (action && action.type !== 'none' && action.needsConfirmation) {
        setPendingAction(action);
        setShowConfirmDialog(true);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Sorry, I encountered an error processing your request.' },
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

  const handleRestock = async (productId: string, quantity: number) => {
    setRestockingProduct(productId);
    try {
      await apiService.restockProduct(productId, quantity);
      
      // Update recommendations to reflect new stock
      setRestockRecommendations(prev =>
        prev.map(item =>
          item.productId === productId
            ? { ...item, currentStock: item.currentStock + quantity }
            : item
        )
      );
      
      // Update chat with success message
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Successfully restocked ${quantity} units. Stock updated for ${restockRecommendations.find(r => r.productId === productId)?.productName || 'product'}.`,
        },
      ]);
    } catch (error) {
      console.error('Restock error:', error);
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Failed to restock. Please try again or contact support.`,
        },
      ]);
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
    if (!pendingAction) return;

    setShowConfirmDialog(false);

    try {
      switch (pendingAction.type) {
        case 'restock':
          if (pendingAction.productId && pendingAction.quantity !== undefined) {
            await handleRestock(pendingAction.productId, pendingAction.quantity);
            setChatMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: `Successfully restocked ${pendingAction.quantity} units of ${pendingAction.productName || 'product'}.`,
              },
            ]);
          } else {
            setChatMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: 'Failed to restock: Missing product information.',
              },
            ]);
          }
          break;
        case 'update_stock':
          if (pendingAction.productName && pendingAction.quantity !== undefined) {
            const product = restockRecommendations.find(r => 
              r.productName.toLowerCase().includes(pendingAction.productName!.toLowerCase())
            );
            if (product) {
              await apiService.updateStock(product.productId, pendingAction.quantity);
              setChatMessages(prev => [
                ...prev,
                {
                  role: 'assistant',
                  content: `Stock updated to ${pendingAction.quantity} units for ${product.productName}.`,
                },
              ]);
            } else {
              setChatMessages(prev => [
                ...prev,
                {
                  role: 'assistant',
                  content: `Product "${pendingAction.productName}" not found in current recommendations.`,
                },
              ]);
            }
          }
          break;
      }
    } catch (error) {
      console.error('Action error:', error);
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Failed to execute action. Please try again.',
        },
      ]);
    } finally {
      setPendingAction(null);
    }
  };

  const handleCancelAction = () => {
    setShowConfirmDialog(false);
    setPendingAction(null);
    setChatMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: 'Action cancelled.',
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
        <h1 className="text-2xl text-slate-900 mb-2">Prediction Error</h1>
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
          Try Again
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
        <h1 className="text-2xl text-slate-900 mb-2">Smart Stock Prediction</h1>
        <p className="text-sm text-slate-500 mb-8 max-w-lg mx-auto">
          Our AI analyzes your sales history, seasonal trends, and upcoming holidays to predict demand and recommend optimal stock levels.
        </p>
        <Button
          onClick={() => handleStartPrediction()}
          size="lg"
          className="shadow-lg hover:shadow-xl"
        >
          <Sparkles className="w-5 h-5" />
          Start Prediction
        </Button>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <TrendingUp className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-base font-medium text-slate-900 mb-1">Trend Analysis</h3>
            <p className="text-sm text-slate-500">Identify patterns in your sales data</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <Calendar className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-base font-medium text-slate-900 mb-1">Holiday Impact</h3>
            <p className="text-sm text-slate-500">Predict spikes during special events</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <AlertTriangle className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-base font-medium text-slate-900 mb-1">Smart Alerts</h3>
            <p className="text-sm text-slate-500">Get notified before stockouts</p>
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
        <h1 className="text-2xl text-slate-900 mb-2">Analyzing Your Data...</h1>
        <p className="text-sm text-slate-500 mb-8">
          Our AI is processing your sales history and generating forecasts
        </p>
        <div className="max-w-md mx-auto">
          <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
          <div className="mt-6 space-y-3 text-left">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Loading sales data...</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Analyzing seasonal patterns...</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span>Generating predictions...</span>
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
        <h1 className="text-2xl text-slate-900 mb-2">System is Learning</h1>
        <p className="text-sm text-slate-500 mb-8 max-w-lg mx-auto">
          We need at least 7 days of sales data to generate accurate predictions. Keep using the system and check back soon!
        </p>
        <div className="bg-white rounded-xl p-6 border border-slate-200 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Data Collection Progress</span>
            <span className="text-sm font-medium text-indigo-600">3/7 days</span>
          </div>
          <div className="bg-slate-200 rounded-full h-3 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full rounded-full" style={{ width: '43%' }}></div>
          </div>
          <p className="text-xs text-slate-400 mt-3">4 more days until predictions are available</p>
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
          <h1 className="text-2xl text-slate-900 mb-1">AI Prediction Results</h1>
          <p className="text-sm text-slate-500">Forecast generated on {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2">
          {([7, 30, 90] as PredictionRange[]).map((days) => (
            <Button
              key={days}
              onClick={() => handleRangeChange(days)}
              variant={predictionRange === days ? 'default' : 'outline'}
            >
              {days} days
            </Button>
          ))}
        </div>
      </div>

      {/* Prediction Summary Cards - Metric Cards */}
      {predictionMeta && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${accuracyDetails?.fit_status === 'good' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-yellow-500 to-orange-600'}`}>
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${accuracyDetails?.fit_status === 'good' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'}`}>
                {accuracyDetails?.fit_status === 'good' ? 'Good Fit' : accuracyDetails?.fit_status || 'N/A'}
              </span>
            </div>
            <h3 className="text-sm text-slate-500 mb-1">Forecast Accuracy</h3>
            <p className="text-2xl font-medium text-slate-900">{forecastAccuracy !== null ? `${forecastAccuracy}%` : 'N/A'}</p>
            <p className="text-xs text-slate-400 mt-2">
              {accuracyDetails?.validation_mape !== null 
                ? `Val MAPE: ${accuracyDetails.validation_mape}%` 
                : 'Model performance'}
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
            <h3 className="text-sm text-slate-500 mb-1">Growth Factor</h3>
            <p className="text-2xl font-medium text-slate-900">{((predictionMeta.applied_factor - 1) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-2">vs last period</p>
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
            <h3 className="text-sm text-slate-500 mb-1">High-Risk Items</h3>
            <p className="text-2xl font-medium text-slate-900">{restockRecommendations.filter(r => r.urgency === 'high').length}</p>
            <p className="text-xs text-slate-400 mt-2">Need immediate restock</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Main Area (70%) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Forecast Chart (INTEGRATED UI/UX HERE) */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-xl font-medium text-slate-900 mb-1">Sales Forecast</h2>
              <p className="text-sm text-slate-500">Historical data vs AI predictions with event markers</p>
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
                  name="Historical Sales"
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
                  name="AI Forecast"
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
                <span className="text-slate-600 text-xs">Past Sales (Fact)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                   <div className="w-6 h-0.5 bg-indigo-600 border-t border-dashed"></div>
                </div>
                <span className="text-slate-600 text-xs">AI Forecast (Est.)</span>
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
              <h2 className="text-xl font-medium text-slate-900 mb-1">Restock Recommendations</h2>
              <p className="text-sm text-slate-500">Products predicted to spike in demand</p>
            </div>
            <div className="space-y-3">
              {restockRecommendations.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between p-6 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-medium text-slate-900">{item.productName}</h3>
                      <span
                        className={`px-3 py-1 rounded-full border text-xs font-medium ${getUrgencyColor(item.urgency)}`}
                      >
                        {item.urgency.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                      {item.category && (
                        <span className="text-xs px-3 py-1 bg-white border border-slate-200 rounded-full font-medium">
                          {item.category}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-slate-700">Current:</span> {item.currentStock}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-slate-700">Predicted:</span> {item.predictedDemand}
                      </span>
                      <span className="text-indigo-600 font-medium flex items-center gap-1">
                        <span className="font-medium">Restock:</span> +{item.recommendedRestock}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleRestock(item.productId, item.recommendedRestock)}
                    disabled={restockingProduct === item.productId}
                    className="ml-4"
                  >
                    {restockingProduct === item.productId ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4" />
                        Restock Now
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {eventAnnotations.length > 0 && (
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <div className="mb-6">
                <h2 className="text-xl font-medium text-slate-900 mb-1">Event Timeline</h2>
                <p className="text-sm text-slate-500">AI considers these promotions, holidays & events in predictions</p>
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

        {/* Support Area (30%) - Smart Insight Panel */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 sticky top-24">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-medium text-slate-900 mb-1">Smart Insights</h2>
              <p className="text-sm text-slate-500">Ask questions about your forecast</p>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-3">
              {chatMessages.map((message, idx) => (
                <div
                  key={idx}
                  className={`${
                    message.role === 'assistant'
                      ? 'bg-indigo-50 text-slate-900 border border-indigo-200'
                      : 'bg-slate-100 text-slate-900 ml-8 border border-slate-200'
                  } p-4 rounded-lg`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-medium text-indigo-600">AI Assistant</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-200">
              {/* Quick Prompts */}
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Quick Questions</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      const highRiskItems = restockRecommendations
                        .filter(r => r.urgency === 'high')
                        .map(r => r.productName)
                        .join(', ');
                      handleQuickPrompt(
                        'Which items need restock?',
                        highRiskItems 
                          ? `High priority items needing restock: ${highRiskItems}. These products are predicted to face stock shortages based on upcoming demand.`
                          : 'All items have adequate stock levels for the forecast period.'
                      );
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    Which items need restock? <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => {
                      const nextEvents = eventAnnotations.slice(0, 2);
                      const eventInfo = nextEvents.length > 0
                        ? nextEvents.map(e => `${e.titles.join(', ')} on ${e.date} (${e.types.join(', ')})`).join(' and ')
                        : 'No major events';
                      handleQuickPrompt(
                        'Why is demand increasing next week?',
                        nextEvents.length > 0
                          ? `Demand is expected to increase due to upcoming events: ${eventInfo}. Historical patterns show sales typically rise ${Math.round(((predictionMeta?.applied_factor || 1) - 1) * 100)}% during similar periods.`
                          : `Demand follows normal seasonal patterns. The forecast shows a ${Math.round(((predictionMeta?.applied_factor || 1) - 1) * 100)}% change based on historical trends.`
                      );
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-full border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    Why is demand increasing? <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => {
                      const topRecommendations = restockRecommendations.slice(0, 3);
                      const summary = topRecommendations
                        .map(r => `${r.productName}: +${r.recommendedRestock} units (${r.urgency} priority)`)
                        .join('; ');
                      handleQuickPrompt(
                        'What are my top priorities?',
                        `Top 3 priorities: ${summary}. Focus on high urgency items first to prevent stockouts.`
                      );
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-full border-green-200 text-green-700 hover:bg-green-50"
                  >
                    Top priorities <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask about predictions..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm"
                />
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  disabled={isChatLoading}
                >
                  {isChatLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'restock' && (
                <>
                  Are you sure you want to restock <strong>{pendingAction.productName || 'this product'}</strong> with <strong>{pendingAction.quantity || 0}</strong> units?
                </>
              )}
              {pendingAction?.type === 'update_stock' && (
                <>
                  Are you sure you want to update the stock of <strong>{pendingAction.productName || 'this product'}</strong> to <strong>{pendingAction.quantity || 0}</strong> units?
                </>
              )}
              {pendingAction?.type === 'add_product' && (
                <>
                  Are you sure you want to add product <strong>{pendingAction.productName || 'new product'}</strong>?
                </>
              )}
              {pendingAction?.type === 'delete_product' && (
                <>
                  Are you sure you want to delete product <strong>{pendingAction.productName || 'this product'}</strong>? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}