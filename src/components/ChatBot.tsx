import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles } from 'lucide-react';
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
            bottom: '110px', 
            right: '24px', 
            zIndex: 9999 
          }}
          className="w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-indigo-200 animate-in"
        >
          {/* Header */}
          <div className="bg-indigo-600 px-5 py-4 flex items-center gap-4">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base">SIPREMS AI</h3>
              <p className="text-indigo-200 text-xs">Asisten Cerdas Anda</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-indigo-50/30 chatbot-messages">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex items-end gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-md shadow-md'
                      : 'bg-white text-slate-700 rounded-bl-md shadow-sm border border-slate-100'
                  }`}
                >
                  {message.content}
                </div>
                {message.role === 'user' && (
                  <div className="w-9 h-9 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-sm font-medium text-slate-600">U</span>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-end gap-3 justify-start">
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white text-slate-500 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="text-sm">Mengetik...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ketik pesan..."
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              Didukung oleh AI
            </p>
          </div>
        </div>
      )}

      {/* Floating Action Button - Bottom Right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          zIndex: 9999 
        }}
        className={`w-16 h-16 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-105 ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800'
            : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <Bot className="w-7 h-7 text-white" />
        )}
      </button>
    </>
  );
}
