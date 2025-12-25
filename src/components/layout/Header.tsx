import { Settings, LogOut, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      <style>{`
        /* Header Critical CSS */
        .header-root {
          position: sticky;
          top: 0;
          z-index: 10;
          background-color: white;
          /* border-bottom removed */
          padding: 1rem;
        }

        /* Profile Avatar Sizing */
        .profile-avatar {
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          object-fit: cover;
        }

        .profile-fallback {
            width: 36px;
            height: 36px;
            border-radius: 9999px;
            background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.875rem;
            font-weight: 500;
        }

        /* User Info Visibility */
        .user-info-desktop {
          display: none;
        }

        /* Large Screen Styles */
        @media (min-width: 1024px) { /* lg */
          .mobile-menu-trigger {
            display: none !important;
          }
          
          .header-root {
            padding-left: 2rem;
            padding-right: 2rem;
          }
          
          .profile-avatar, .profile-fallback {
            width: 40px;
            height: 40px;
          }
        }

        /* Medium Screen Styles */
        @media (min-width: 768px) { /* md */
           .user-info-desktop {
              display: flex;
              flex-direction: column;
              text-align: right;
           }
        }
      `}</style>
      
      <header className="header-root">
        <div className="flex items-center justify-between">
          {/* Left section - Mobile menu */}
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Menu Button */}
            <button
              onClick={onOpenMobileSidebar}
              className="mobile-menu-trigger p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Right section - Notification + Profile */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Notification Center */}
            <NotificationCenter />
            <div className="relative pl-2 lg:pl-4" ref={dropdownRef}>
              <div 
                className="flex items-center gap-2 lg:gap-3 cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
              >
                {/* User info - hidden on mobile */}
                <div className="user-info-desktop">
                  <p className="text-slate-900 font-bold text-sm">{user?.displayName || 'User'}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="profile-avatar"
                  />
                ) : (
                  <div className="profile-fallback">
                    <span>
                      {getInitials(user?.displayName || user?.email || 'U')}
                    </span>
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  {/* User info for mobile */}
                  <div className="md:hidden px-4 py-2 border-b border-gray-200">
                    <p className="text-slate-900 font-bold text-sm">{user?.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>

                  <Link
                    to="/settings"
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <Settings className="w-4 h-4 text-slate-600" />
                    <span className="text-slate-700">Pengaturan</span>
                  </Link>
                  
                  <div className="my-2 border-t border-gray-200"></div>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 transition-colors text-red-600"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
