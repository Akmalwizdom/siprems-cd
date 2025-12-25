import { useState, useRef, useEffect } from 'react';
import { Bell, Package, AlertTriangle, CheckCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useStockNotification } from '../../hooks/useStockNotification';
import { StockNotification } from '../../types';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return 'Kemarin';
  return `${diffDays} hari lalu`;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const {
    notifications,
    unreadCount,
    criticalCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useStockNotification();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: StockNotification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    navigate('/products');
  };

  return (
    <>
      <style>{`
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          10%, 30%, 50%, 70%, 90% { transform: rotate(-5deg); }
          20%, 40%, 60%, 80% { transform: rotate(5deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        .notification-bell-shake {
          animation: bellShake 0.6s ease-in-out;
        }
        
        .notification-badge-pulse {
          animation: pulse 2s infinite;
        }
        
        .notification-dropdown {
          max-height: 400px;
          overflow-y: auto;
        }
        
        .notification-dropdown::-webkit-scrollbar {
          width: 6px;
        }
        
        .notification-dropdown::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        
        .notification-dropdown::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        
        .notification-item {
          transition: all 0.2s ease;
        }
        
        .notification-item:hover {
          background-color: #f8fafc;
        }
      `}</style>

      <div className="relative" ref={dropdownRef}>
        {/* Bell Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-2 rounded-lg hover:bg-slate-100 transition-colors ${
            criticalCount > 0 ? 'text-red-600' : 'text-slate-600'
          }`}
          aria-label="Notifikasi"
        >
          <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'notification-bell-shake' : ''}`} />
          
          {/* Badge */}
          {unreadCount > 0 && (
            <span 
              className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white rounded-full ${
                criticalCount > 0 
                  ? 'bg-red-500 notification-badge-pulse' 
                  : 'bg-amber-500'
              }`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown - Positioned to the left of the bell icon */}
        {isOpen && (
          <div 
            className="absolute top-0 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden"
            style={{ right: '100%', marginRight: '0.75rem', width: '320px' }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">Notifikasi</h3>
                {unreadCount > 0 && (
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                    {unreadCount} baru
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Tandai semua sudah dibaca"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus semua"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Notification List */}
            <div className="notification-dropdown">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">Tidak ada notifikasi</p>
                  <p className="text-xs text-slate-400 mt-1">Stok Anda dalam kondisi baik!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.slice(0, 20).map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-item px-4 py-3 cursor-pointer ${
                        !notification.isRead ? 'bg-indigo-50/50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          notification.severity === 'critical' 
                            ? 'bg-red-100' 
                            : 'bg-amber-100'
                        }`}>
                          {notification.severity === 'critical' ? (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          ) : (
                            <Package className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              notification.severity === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {notification.severity === 'critical' ? 'Kritis' : 'Rendah'}
                            </span>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-900 mt-1 break-words">
                            {notification.productName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Stok: <span className={notification.severity === 'critical' ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                              {notification.currentStock} unit
                            </span>
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/products');
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium w-full text-center"
                >
                  Lihat Semua Produk →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
