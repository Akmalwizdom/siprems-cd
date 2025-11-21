import { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, MessageSquare, Send, ChevronRight, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useStore } from '../context/StoreContext';
import { apiService, type PredictionResponse } from '../services/api';
import { PredictionData, RestockRecommendation } from '../types';

type PredictionState = 'idle' | 'loading' | 'result' | 'learning' | 'error';

export function SmartPrediction() {
  const { events } = useStore();
  const [state, setState] = useState<PredictionState>('idle');
  const [showChatbot, setShowChatbot] = useState(false);
  const [predictionData, setPredictionData] = useState<PredictionData[]>([]);
  const [restockRecommendations, setRestockRecommendations] = useState<RestockRecommendation[]>([]);
  const [error, setError] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: 'I\'m your AI assistant. Click "Start Prediction" to generate stock forecasts based on your calendar events and sales history.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  const handleStartPrediction = async () => {
    setState('loading');
    setError('');

    try {
      // Convert StoreContext events to API format
      const apiEvents = events.map(event => ({
        date: event.date,
        type: event.type,
        title: event.title,
      }));

      // Call the API
      const response = await apiService.getPrediction('store_1', apiEvents);

      if (response.status === 'success') {
        setPredictionData(response.chartData);
        setRestockRecommendations(response.recommendations);

        // Update chatbot with insights
        const firstHoliday = response.chartData.find(d => d.isHoliday);
        const initialMessage = firstHoliday
          ? `Sales spike predicted around ${firstHoliday.date}. Historical data shows significant increase during ${firstHoliday.holidayName}. Consider restocking high-demand items early.`
          : 'Prediction complete. Review the forecast and recommendations below.';

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

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    setChatMessages([
      ...chatMessages,
      { role: 'user', content: chatInput },
      {
        role: 'assistant',
        content: 'Based on your query, I recommend focusing on restocking Coffee Mugs and Desk Lamps as they show the highest predicted demand. Would you like specific quantity recommendations?',
      },
    ]);
    setChatInput('');
  };

  const getUrgencyColor = (urgency: string) => {
    return {
      high: 'text-red-600 bg-red-50 border-red-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-green-600 bg-green-50 border-green-200',
    }[urgency] || 'text-slate-600 bg-slate-50 border-slate-200';
  };

  // Error State
  if (state === 'error') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex w-24 h-24 bg-gradient-to-br from-red-600 to-orange-600 rounded-3xl items-center justify-center mb-6">
          <AlertTriangle className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-slate-900 mb-4">Prediction Error</h1>
        <p className="text-red-600 mb-8 max-w-lg mx-auto">{error}</p>
        <button
          onClick={() => setState('idle')}
          className="inline-flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
        >
          <Sparkles className="w-5 h-5" />
          Try Again
        </button>
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
        <h1 className="text-slate-900 mb-4">Smart Stock Prediction</h1>
        <p className="text-slate-600 mb-8 max-w-lg mx-auto">
          Our AI analyzes your sales history, seasonal trends, and upcoming holidays to predict demand and recommend optimal stock levels.
        </p>
        <button
          onClick={handleStartPrediction}
          className="inline-flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
        >
          <Sparkles className="w-5 h-5" />
          Start Prediction
        </button>
        <div className="mt-12 grid grid-cols-3 gap-4 text-left">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <TrendingUp className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-slate-900 mb-2">Trend Analysis</h3>
            <p className="text-xs text-slate-600">Identify patterns in your sales data</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <Calendar className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-slate-900 mb-2">Holiday Impact</h3>
            <p className="text-xs text-slate-600">Predict spikes during special events</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <AlertTriangle className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="text-slate-900 mb-2">Smart Alerts</h3>
            <p className="text-xs text-slate-600">Get notified before stockouts</p>
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
        <h1 className="text-slate-900 mb-4">Analyzing Your Data...</h1>
        <p className="text-slate-600 mb-8">
          Our AI is processing your sales history and generating forecasts
        </p>
        <div className="max-w-md mx-auto">
          <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
          <div className="mt-4 space-y-2 text-left">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Loading sales data...</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Analyzing seasonal patterns...</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
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
        <h1 className="text-slate-900 mb-4">System is Learning</h1>
        <p className="text-slate-600 mb-8 max-w-lg mx-auto">
          We need at least 7 days of sales data to generate accurate predictions. Keep using the system and check back soon!
        </p>
        <div className="bg-white rounded-xl p-6 border border-slate-200 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-700">Data Collection Progress</span>
            <span className="text-indigo-600">3/7 days</span>
          </div>
          <div className="bg-slate-200 rounded-full h-3 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full rounded-full" style={{ width: '43%' }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-3">4 more days until predictions are available</p>
        </div>
      </div>
    );
  }

  // Result State
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-1">AI Prediction Results</h1>
          <p className="text-slate-500">12-week forecast generated on {new Date().toLocaleDateString()}</p>
        </div>
        <button
          onClick={() => setState('idle')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Run New Prediction
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Main Area (70%) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Forecast Chart */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-slate-900 mb-1">Sales Forecast</h2>
              <p className="text-slate-500">Historical data vs AI predictions with holiday markers</p>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={predictionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="#64748b"
                  strokeWidth={2}
                  name="Historical Sales"
                  dot={{ fill: '#64748b', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="AI Prediction"
                  dot={{ fill: '#4f46e5', r: 4 }}
                />
                {predictionData && predictionData
                  .filter((d) => d.isHoliday)
                  .map((holiday, idx) => (
                    <ReferenceLine
                      key={idx}
                      x={holiday.date}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label={{
                        value: holiday.holidayName || 'Event',
                        position: 'top',
                        fill: '#ef4444',
                        fontSize: 12,
                      }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-600 rounded-full"></div>
                <span className="text-slate-600">Historical</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                <span className="text-slate-600">Predicted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-red-500"></div>
                <span className="text-slate-600">Holiday</span>
              </div>
            </div>
          </div>

          {/* Restock Recommendations */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-slate-900 mb-1">Restock Recommendations</h2>
              <p className="text-slate-500">Products predicted to spike in demand</p>
            </div>
            <div className="space-y-3">
              {restockRecommendations.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex-1">
                    <h3 className="text-slate-900 mb-1">{item.productName}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span>Current: {item.currentStock}</span>
                      <span>Predicted: {item.predictedDemand}</span>
                      <span className="text-indigo-600">
                        Restock: +{item.recommendedRestock}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full border ${getUrgencyColor(item.urgency)}`}
                  >
                    {item.urgency.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Support Area (30%) - Smart Insight Panel */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 sticky top-24">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <h3 className="text-slate-900">Smart Insights</h3>
              </div>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-4">
              {chatMessages.map((message, idx) => (
                <div
                  key={idx}
                  className={`${
                    message.role === 'assistant'
                      ? 'bg-indigo-50 text-slate-900'
                      : 'bg-slate-100 text-slate-900 ml-8'
                  } p-3 rounded-lg`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs text-indigo-600">AI Assistant</span>
                    </div>
                  )}
                  <p className="text-sm">{message.content}</p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask about predictions..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSendMessage}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setChatInput('Why is there a spike in Week 6?');
                    setTimeout(handleSendMessage, 100);
                  }}
                  className="text-xs px-3 py-1 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
                >
                  Why the spike? <ChevronRight className="w-3 h-3 inline" />
                </button>
                <button
                  onClick={() => {
                    setChatInput('Show me top 3 priorities');
                    setTimeout(handleSendMessage, 100);
                  }}
                  className="text-xs px-3 py-1 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
                >
                  Top priorities <ChevronRight className="w-3 h-3 inline" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
