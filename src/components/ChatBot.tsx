import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, Sparkles, User } from 'lucide-react';
import { geminiService, type ChatMessage } from '../services/gemini';

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Halo! Saya asisten AI SIPREMS. Ada yang bisa saya bantu?',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
        null,
        [...messages, userMessage]
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
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

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
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