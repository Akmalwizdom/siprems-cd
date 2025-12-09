import { createBrowserRouter, Navigate } from 'react-router';
import { MainLayout } from '../components/layout/MainLayout';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { Dashboard } from '../pages/Dashboard';
import { Transaction } from '../pages/Transaction';
import { Products } from '../pages/Products';
import { CalendarImproved as Calendar } from '../pages/CalendarImproved';
import { SmartPrediction } from '../pages/SmartPrediction';
import { Settings } from '../pages/Settings';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { GuestRoute } from '../components/auth/GuestRoute';

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/', Component: Login },
      { path: '/register', Component: Register },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/dashboard', Component: Dashboard },
          { path: '/transaction', Component: Transaction },
          { path: '/products', Component: Products },
          { path: '/calendar', Component: Calendar },
          { path: '/prediction', Component: SmartPrediction },
          { path: '/settings', Component: Settings },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);