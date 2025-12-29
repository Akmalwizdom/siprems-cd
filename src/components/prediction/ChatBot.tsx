import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, Sparkles, User, Check, XCircle } from 'lucide-react';
import { geminiService, type ChatMessage, type CommandAction } from '../../services/gemini';
import { PredictionResponse, apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/toast';

interface ChatBotProps {
  predictionData?: PredictionResponse | null;
  onRestockSuccess?: (productId: string, quantity: number) => void;
}

export function ChatBot({ predictionData = null, onRestockSuccess }: ChatBotProps) {
  const { getAuthToken } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Halo! Saya asisten AI Siprems. Ada yang bisa saya bantu?',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<CommandAction | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Resize state
  const [size, setSize] = useState({ width: 380, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizingRef.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      
      const newWidth = Math.max(300, Math.min(800, window.innerWidth - e.clientX - 24));
      const newHeight = Math.max(400, Math.min(window.innerHeight - 150, window.innerHeight - e.clientY - 110));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizingRef.current = false;
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await geminiService.chat(
        userMessage.content,
        predictionData,
        [...messages, userMessage]
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Check if action needs confirmation
      if (response.action && response.action.type !== 'none' && response.action.needsConfirmation) {
        setPendingAction(response.action);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction || isConfirming) return;

    setIsConfirming(true);

    try {
      if (pendingAction.type === 'restock' && pendingAction.quantity) {
        // ALWAYS lookup productId by name from recommendations
        // AI doesn't know real product IDs, it sends product NAME as productId
        const recommendations = predictionData?.recommendations || [];
        
        let productId: string | null = null;
        const productNameToFind = pendingAction.productName || pendingAction.productId; // AI might send name as productId
        
        if (productNameToFind) {
          // Try exact match first
          const exactMatch = recommendations.find(
            (rec) => rec.productName.toLowerCase() === productNameToFind.toLowerCase()
          );
          if (exactMatch) {
            productId = exactMatch.productId;
          } else {
            // Try partial match
            const partialMatch = recommendations.find(
              (rec) => rec.productName.toLowerCase().includes(productNameToFind.toLowerCase()) ||
                       productNameToFind.toLowerCase().includes(rec.productName.toLowerCase())
            );
            if (partialMatch) {
              productId = partialMatch.productId;
            }
          }
        }

        if (!productId) {
          const errorMsg = `Produk "${productNameToFind}" tidak ditemukan di daftar rekomendasi. Pastikan prediksi sudah dijalankan.`;
          console.error('[ChatBot]', errorMsg);
          console.error('[ChatBot] Available recommendations:', recommendations.map(r => r.productName));
          throw new Error(errorMsg);
        }

        // Get auth token for API call
        const token = await getAuthToken();
        await apiService.restockProduct(productId, pendingAction.quantity, token || undefined);
        
        const successMessage: ChatMessage = {
          role: 'assistant',
          content: `✅ Berhasil! Stok ${pendingAction.productName || 'produk'} telah ditambah sebanyak ${pendingAction.quantity} unit.`,
        };
        setMessages((prev) => [...prev, successMessage]);
        
        // Show toast notification
        showToast(`${pendingAction.productName}: Berhasil menambahkan ${pendingAction.quantity} unit ke stok`, 'success', 5000);
        
        // Notify parent to update stock in UI (realtime update)
        onRestockSuccess?.(productId, pendingAction.quantity);
      } else if (pendingAction.type === 'bulk_restock') {
        // Handle bulk restock - iterate through recommendations
        const recommendations = predictionData?.recommendations || [];
        const bulkToken = await getAuthToken();
        let successCount = 0;
        
        for (const rec of recommendations) {
          if (rec.recommendedRestock > 0) {
            try {
              await apiService.restockProduct(rec.productId, rec.recommendedRestock, bulkToken || undefined);
              successCount++;
              // Notify parent to update stock in UI (realtime update)
              onRestockSuccess?.(rec.productId, rec.recommendedRestock);
            } catch (e) {
              console.error(`Failed to restock ${rec.productName}:`, e);
            }
          }
        }
        
        const successMessage: ChatMessage = {
          role: 'assistant',
          content: `✅ Berhasil! ${successCount} produk telah di-restock sesuai rekomendasi.`,
        };
        setMessages((prev) => [...prev, successMessage]);
        showToast(`${successCount} produk telah di-restock sesuai rekomendasi`, 'success', 5000);
      }
    } catch (error) {
      console.error('[ChatBot] Confirm action error:', error);
      const errorDetail = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Gagal melakukan restock: ${errorDetail}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
      showToast(`Gagal melakukan restock: ${errorDetail}`, 'error', 5000);
    } finally {
      setIsConfirming(false);
      setPendingAction(null);
    }
  };

  const handleCancelAction = () => {
    const cancelMessage: ChatMessage = {
      role: 'assistant',
      content: 'Baik, aksi dibatalkan. Ada yang lain yang bisa saya bantu?',
    };
    setMessages((prev) => [...prev, cancelMessage]);
    setPendingAction(null);
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div 
          style={{ 
            position: 'fixed', 
            bottom: '100px', // Sedikit dinaikkan agar tidak menumpuk dengan tombol bulat
            right: '24px', 
            width: `${size.width}px`,
            height: `${size.height}px`,
            zIndex: 9999 
          }}
          className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in relative"
        >
          {/* Resize Handle (Top-Left Corner) */}
          <div
            onMouseDown={startResizing}
            className="absolute top-0 left-0 w-6 h-6 cursor-nw-resize z-50 flex items-center justify-center group"
            title="Drag to resize"
          >
            <div className="w-4 h-4 rounded-full bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div 
            className="bg-indigo-600 px-6 py-4 flex items-center gap-4 shrink-0 cursor-move"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 flex flex-col justify-center select-none">
              <h3 className="text-white font-semibold text-lg leading-tight">SIPREMS AI</h3>
              <p className="text-indigo-100 text-xs mt-0.5">Asisten Cerdas Anda</p>
            </div>
            {/* Tombol X dihapus dari sini */}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 chatbot-messages">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex items-end gap-2 w-full ${
                  // Logic 1: Bubble chat user sebelah kanan (justify-end)
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Bot Avatar (Only show for assistant) */}
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm order-1">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}

                {/* Bubble Text */}
                <div
                  className={`max-w-[80%] px-3 py-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none ml-auto' 
                      : 'bg-white text-slate-700 rounded-bl-none border border-slate-100' 
                  }`}
                >
                  {message.content}
                </div>

                {/* User Avatar (Only show for user) */}
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm order-3">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-end gap-2 justify-start w-full">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white text-slate-500 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="text-xs">Mengetik...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area / Confirmation Buttons */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            {pendingAction ? (
              /* Confirmation Buttons */
              <div className="space-y-3">
                <p className="text-xs text-center text-slate-500">
                  Konfirmasi {pendingAction.type === 'restock' ? `restock ${pendingAction.productName}` : 'restock semua produk'}?
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleCancelAction}
                    disabled={isConfirming}
                    className="flex-1 py-3.5 px-4 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors duration-200 font-semibold"
                  >
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">Batal</span>
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    disabled={isConfirming}
                    className="flex-1 py-3.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 border border-transparent text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-colors duration-200 shadow-sm"
                  >
                    {isConfirming ? (
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    ) : (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{isConfirming ? 'Proses...' : 'Konfirmasi'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Normal Input */
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-inner">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ketik pesan..."
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none min-w-0"
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                  className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0 shadow-sm"
                >
                  <Send className="w-5 h-5 text-white ml-0.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logic 4: Floating Action Button (Robot <-> Cross) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          zIndex: 9999 
        }}
        className={`w-10 h-10 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ${
          isOpen
            ? 'bg-red-500 hover:bg-red-600 rotate-90' // Warna merah dan rotasi saat open (tanda silang)
            : 'bg-indigo-600 hover:bg-indigo-700 rotate-0' // Warna biru saat closed (robot)
        }`}
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white transition-transform duration-300" />
        ) : (
          <Bot className="w-7 h-7 text-white transition-transform duration-300" />
        )}
      </button>
    </>
  );
}