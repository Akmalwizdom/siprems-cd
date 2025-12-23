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
  imageUrl?: string;
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
  lower?: number;
  upper?: number;
}

export interface RestockRecommendation {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDemand: number;
  recommendedRestock: number;
  urgency: 'low' | 'medium' | 'high';
  category?: string;
  // Enhanced fields from ProductForecastService
  safetyStock?: number;
  daysOfStock?: number;
  confidence?: number;
  categoryGrowthFactor?: number;
  historicalSales?: number;
  salesProportion?: number;
}

export interface CalendarEventType {
  date: string;
  type: 'promotion' | 'holiday' | 'store-closed' | 'event';
  title?: string;
  impact?: number;
}

export interface PredictionResponseMeta {
  applied_factor: number;
  historicalDays?: number;
  forecastDays?: number;
  lastHistoricalDate?: string;
  regressors?: string[];
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
