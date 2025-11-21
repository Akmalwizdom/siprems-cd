import { NavLink } from 'react-router';
import { LayoutDashboard, ShoppingCart, Package, Brain, Settings, Calendar } from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/transaction', icon: ShoppingCart, label: 'Transaction' },
  { path: '/products', icon: Package, label: 'Products' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/prediction', icon: Brain, label: 'Smart Prediction' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white">S</span>
          </div>
          <div>
            <h1 className="text-slate-900">SIPREMS</h1>
            <p className="text-xs text-slate-500">Smart POS System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 m-3 bg-slate-900 rounded-xl">
        <div className="text-white mb-3">
          <h3>Upgrade Pro</h3>
          <p className="text-xs text-slate-400 mt-1">
            Unlock full features and get unlimited access
          </p>
        </div>
        <button className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          Upgrade $30
        </button>
      </div>
    </aside>
  );
}