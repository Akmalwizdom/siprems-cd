import React, { useState, useEffect } from 'react';
import { X, Package, AlertTriangle, Info, Minus, Plus, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  product: {
    productId: string;
    productName: string;
    currentStock: number;
    predictedDemand: number;
    recommendedRestock: number;
    urgency: 'high' | 'medium' | 'low';
    category?: string;
  } | null;
  isLoading: boolean;
}

export function RestockModal({
  isOpen,
  onClose,
  onConfirm,
  product,
  isLoading,
}: RestockModalProps) {
  const [quantity, setQuantity] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);

  // Reset quantity when modal opens with new product
  useEffect(() => {
    if (product && isOpen) {
      setQuantity(product.recommendedRestock);
      setSliderValue(product.recommendedRestock);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const minQuantity = 1;
  const maxQuantity = Math.max(product.recommendedRestock * 2, product.predictedDemand, 100);
  
  // Calculate status based on quantity vs recommendation
  const getQuantityStatus = () => {
    const ratio = quantity / product.recommendedRestock;
    
    if (quantity <= 0) {
      return { 
        type: 'error' as const, 
        message: 'Jumlah harus lebih dari 0',
        color: 'text-red-600 bg-red-50'
      };
    }
    if (ratio < 0.5) {
      return { 
        type: 'warning' as const, 
        message: `${Math.round((1 - ratio) * 100)}% kurang dari rekomendasi AI. Risiko kehabisan stok.`,
        color: 'text-orange-600 bg-orange-50'
      };
    }
    if (ratio < 0.9) {
      return { 
        type: 'caution' as const, 
        message: `${Math.round((1 - ratio) * 100)}% kurang dari rekomendasi AI.`,
        color: 'text-yellow-600 bg-yellow-50'
      };
    }
    if (ratio <= 1.1) {
      return { 
        type: 'optimal' as const, 
        message: 'Sesuai dengan rekomendasi AI.',
        color: 'text-green-600 bg-green-50'
      };
    }
    if (ratio <= 1.5) {
      return { 
        type: 'info' as const, 
        message: `${Math.round((ratio - 1) * 100)}% lebih dari rekomendasi AI.`,
        color: 'text-blue-600 bg-blue-50'
      };
    }
    return { 
      type: 'warning' as const, 
      message: `${Math.round((ratio - 1) * 100)}% lebih dari rekomendasi. Risiko over-stock.`,
      color: 'text-red-700 bg-red-100'
    };
  };

  const status = getQuantityStatus();
  const newStock = product.currentStock + quantity;
  const coverageDays = product.predictedDemand > 0 
    ? Math.round((newStock / product.predictedDemand) * 30)
    : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
    setQuantity(value);
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    const clampedValue = Math.min(Math.max(value, 0), maxQuantity);
    setQuantity(clampedValue);
    setSliderValue(clampedValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(quantity + 1, maxQuantity);
    setQuantity(newValue);
    setSliderValue(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(quantity - 1, minQuantity);
    setQuantity(newValue);
    setSliderValue(newValue);
  };

  const handleConfirm = () => {
    if (quantity > 0 && !isLoading) {
      onConfirm(quantity);
    }
  };

  const getUrgencyBadge = () => {
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-green-100 text-green-700 border-green-200',
    };
    return colors[product.urgency] || colors.low;
  };

  // Calculate slider percentage for the filled track
  const sliderPercentage = ((sliderValue - minQuantity) / (maxQuantity - minQuantity)) * 100;
  const recommendationPercentage = ((product.recommendedRestock - minQuantity) / (maxQuantity - minQuantity)) * 100;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg transform rounded-2xl bg-white shadow-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Isi Ulang Stok</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="px-6 py-5 space-y-5">
            {/* Product Info */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-600 rounded-xl">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-slate-900">{product.productName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {product.category && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {product.category}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getUrgencyBadge()}`}>
                    {product.urgency.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Stock Info Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Stok Saat Ini</p>
                <p className="text-lg font-semibold text-slate-900">{product.currentStock}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Prediksi Demand</p>
                <p className="text-lg font-semibold text-slate-900">{product.predictedDemand}</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-xs text-indigo-600 mb-1">Rekomendasi AI</p>
                <p className="text-lg font-semibold text-indigo-600">+{product.recommendedRestock}</p>
              </div>
            </div>

            {/* Quantity Input Section */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Jumlah Pengisian
              </label>
              
              {/* Number Stepper */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleDecrement}
                  disabled={quantity <= minQuantity || isLoading}
                  className="p-3 rounded-xl border-2 border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Minus className="h-5 w-5" />
                </button>
                
                <input
                  type="number"
                  value={quantity}
                  onChange={handleQuantityChange}
                  disabled={isLoading}
                  className="w-24 text-center text-2xl font-semibold text-slate-900 border-2 border-slate-200 rounded-xl py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:opacity-50"
                  min={minQuantity}
                  max={maxQuantity}
                />
                
                <button
                  onClick={handleIncrement}
                  disabled={quantity >= maxQuantity || isLoading}
                  className="p-3 rounded-xl border-2 border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Native Slider */}
              <div className="pt-2 px-1">
                <input
                  type="range"
                  min={minQuantity}
                  max={maxQuantity}
                  value={sliderValue}
                  onChange={handleSliderChange}
                  disabled={isLoading}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                {/* Labels */}
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>{minQuantity}</span>
                  <span className="text-indigo-600 font-medium">
                    ↑ Rekomendasi AI: {product.recommendedRestock}
                  </span>
                  <span>{maxQuantity}</span>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className={`flex items-start gap-3 p-3 rounded-xl ${status.color}`}>
              {status.type === 'error' || status.type === 'warning' ? (
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : status.type === 'optimal' ? (
                <TrendingUp className="h-5 w-5 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
              )}
              <span className="text-sm">{status.message}</span>
            </div>

            {/* Result Preview */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Hasil setelah pengisian:
              </h4>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Stok baru:</span>
                <span className="font-semibold text-slate-900">
                  {product.currentStock} + {quantity} = <span className="text-indigo-600">{newStock} unit</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Estimasi coverage:</span>
                <span className="font-semibold text-slate-900">
                  ~{coverageDays} hari
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={quantity <= 0 || isLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">●</span>
                  Memproses...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Konfirmasi Pengisian
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
