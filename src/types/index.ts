// Core TypeScript Interfaces for SIPREMS

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  storeName: string;
  avatar?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  image?: string;
  description?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Transaction {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalTransactions: number;
  totalItemsSold: number;
  revenueChange: number;
  transactionsChange: number;
  itemsChange: number;
}

export interface SalesData {
  date: string;
  sales: number;
  transactions: number;
}

export interface CategorySales {
  category: string;
  value: number;
  color: string;
}

export interface PredictionData {
  date: string;
  historical: number | null;
  predicted: number | null;
  isHoliday: boolean;
  holidayName?: string;
}

export interface RestockRecommendation {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  recommendedRestock: number;
  urgency: 'low' | 'medium' | 'high';
}

export interface CalendarEventType {
  date: string;
  type: 'promotion' | 'holiday' | 'store-closed';
  title?: string;
}

export interface PredictionResponseMeta {
  applied_factor: number;
}

export interface StoreSettings {
  name: string;
  address: string;
  openingHours: {
    [key: string]: { open: string; close: string; closed: boolean };
  };
  customHolidays: string[];
}

export type TimeRange = 'today' | 'week' | 'month' | 'year';

export type StockStatus = 'critical' | 'low' | 'good';
