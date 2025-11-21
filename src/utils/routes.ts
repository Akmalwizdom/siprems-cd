import { createBrowserRouter } from 'react-router';
import { MainLayout } from '../components/layout/MainLayout';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { Dashboard } from '../pages/Dashboard';
import { Transaction } from '../pages/Transaction';
import { Products } from '../pages/Products';
import { Calendar } from '../pages/Calendar';
import { SmartPrediction } from '../pages/SmartPrediction';
import { Settings } from '../pages/Settings';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/register',
    Component: Register,
  },
  {
    path: '/',
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'transaction', Component: Transaction },
      { path: 'products', Component: Products },
      { path: 'calendar', Component: Calendar },
      { path: 'prediction', Component: SmartPrediction },
      { path: 'settings', Component: Settings },
      { path: '*', Component: Dashboard },
    ],
  },
  {
    path: '*',
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
    ],
  },
]);