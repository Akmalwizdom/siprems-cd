import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const toastStyles: Record<ToastType, { bg: string; icon: React.ElementType; color: string }> = {
  success: { bg: 'bg-green-500', icon: CheckCircle, color: 'text-white' },
  error: { bg: 'bg-red-500', icon: AlertCircle, color: 'text-white' },
  warning: { bg: 'bg-yellow-500', icon: AlertTriangle, color: 'text-white' },
  info: { bg: 'bg-blue-500', icon: Info, color: 'text-white' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    console.log('[Toast] showToast called:', { message, type, duration });
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { id, message, type, duration };
    
    setToasts((prev) => {
      console.log('[Toast] Adding toast, current count:', prev.length);
      return [...prev, newToast];
    });

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
}

import { createPortal } from 'react-dom';

function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  console.log('[Toast] ToastContainer render, toasts count:', toasts.length);
  
  if (toasts.length === 0) return null;

  return createPortal(
    <div 
      className="fixed top-4 right-4 flex flex-col gap-2 max-w-sm"
      style={{ zIndex: 999999 }}
    >
      {toasts.map((toast) => {
        const style = toastStyles[toast.type];
        const Icon = style.icon;
        console.log('[Toast] Rendering toast:', toast.id, toast.message);
        
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.color} px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3`}
            style={{ 
              animation: 'slideInFromRight 0.3s ease-out',
              border: '2px solid rgba(255,255,255,0.3)'
            }}
            role="alert"
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => onClose(toast.id)}
              className="p-1 hover:bg-black/10 rounded transition-colors"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
