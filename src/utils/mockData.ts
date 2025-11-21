import { Product, SalesData, CategorySales, PredictionData, RestockRecommendation, User, DashboardMetrics } from '../types';

export const mockUser: User = {
  id: '1',
  name: 'Ferra Alexandra',
  email: 'ferra@siprems.com',
  role: 'Admin',
  storeName: 'Admin Store',
};

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Wireless Mouse',
    category: 'Electronics',
    costPrice: 15,
    sellingPrice: 25,
    stock: 45,
    description: 'Ergonomic wireless mouse with USB receiver',
  },
  {
    id: '2',
    name: 'Coffee Mug',
    category: 'Home & Kitchen',
    costPrice: 5,
    sellingPrice: 12,
    stock: 3,
    description: 'Ceramic coffee mug, 350ml capacity',
  },
  {
    id: '3',
    name: 'Notebook A5',
    category: 'Stationery',
    costPrice: 3,
    sellingPrice: 8,
    stock: 120,
    description: 'A5 lined notebook, 200 pages',
  },
  {
    id: '4',
    name: 'USB Cable',
    category: 'Electronics',
    costPrice: 4,
    sellingPrice: 10,
    stock: 67,
    description: 'USB-C to USB-A cable, 1.5m',
  },
  {
    id: '5',
    name: 'Water Bottle',
    category: 'Sports',
    costPrice: 8,
    sellingPrice: 18,
    stock: 28,
    description: 'Stainless steel water bottle, 750ml',
  },
  {
    id: '6',
    name: 'Headphones',
    category: 'Electronics',
    costPrice: 25,
    sellingPrice: 50,
    stock: 15,
    description: 'Over-ear wireless headphones',
  },
  {
    id: '7',
    name: 'Desk Lamp',
    category: 'Home & Kitchen',
    costPrice: 20,
    sellingPrice: 40,
    stock: 12,
    description: 'LED desk lamp with adjustable brightness',
  },
  {
    id: '8',
    name: 'Backpack',
    category: 'Fashion',
    costPrice: 30,
    sellingPrice: 60,
    stock: 22,
    description: 'Laptop backpack with multiple compartments',
  },
];

export const getDashboardMetrics = (range: string): DashboardMetrics => {
  const metrics = {
    today: {
      totalRevenue: 1250,
      totalTransactions: 28,
      totalItemsSold: 145,
      revenueChange: 12.5,
      transactionsChange: 8.3,
      itemsChange: 15.2,
    },
    week: {
      totalRevenue: 8750,
      totalTransactions: 187,
      totalItemsSold: 892,
      revenueChange: 18.4,
      transactionsChange: 12.7,
      itemsChange: 21.5,
    },
    month: {
      totalRevenue: 35420,
      totalTransactions: 756,
      totalItemsSold: 3547,
      revenueChange: 24.8,
      transactionsChange: 19.2,
      itemsChange: 28.6,
    },
    year: {
      totalRevenue: 412917,
      totalTransactions: 9829,
      totalItemsSold: 47832,
      revenueChange: 32.4,
      transactionsChange: 28.9,
      itemsChange: 35.7,
    },
  };
  return metrics[range as keyof typeof metrics] || metrics.month;
};

export const getSalesData = (range: string): SalesData[] => {
  const dataMap = {
    today: Array.from({ length: 24 }, (_, i) => ({
      date: `${i}:00`,
      sales: Math.floor(Math.random() * 200) + 50,
      transactions: Math.floor(Math.random() * 10) + 1,
    })),
    week: Array.from({ length: 7 }, (_, i) => ({
      date: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      sales: Math.floor(Math.random() * 2000) + 800,
      transactions: Math.floor(Math.random() * 50) + 20,
    })),
    month: Array.from({ length: 30 }, (_, i) => ({
      date: `Day ${i + 1}`,
      sales: Math.floor(Math.random() * 1500) + 500,
      transactions: Math.floor(Math.random() * 40) + 15,
    })),
    year: Array.from({ length: 12 }, (_, i) => ({
      date: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
      sales: Math.floor(Math.random() * 40000) + 20000,
      transactions: Math.floor(Math.random() * 800) + 400,
    })),
  };
  return dataMap[range as keyof typeof dataMap] || dataMap.month;
};

export const categorySales: CategorySales[] = [
  { category: 'Electronics', value: 2487, color: '#3b82f6' },
  { category: 'Home & Kitchen', value: 1823, color: '#ef4444' },
  { category: 'Stationery', value: 1463, color: '#f59e0b' },
  { category: 'Sports', value: 987, color: '#10b981' },
  { category: 'Fashion', value: 1245, color: '#8b5cf6' },
];

export const predictionData: PredictionData[] = [
  { date: 'Week 1', historical: 1200, predicted: 1250 },
  { date: 'Week 2', historical: 1350, predicted: 1400 },
  { date: 'Week 3', historical: 1100, predicted: 1150 },
  { date: 'Week 4', historical: 1450, predicted: 1500 },
  { date: 'Week 5', historical: 0, predicted: 1650 },
  { date: 'Week 6', historical: 0, predicted: 2800, isHoliday: true, holidayName: 'Eid Al-Fitr' },
  { date: 'Week 7', historical: 0, predicted: 2200, isHoliday: true, holidayName: 'Eid Al-Fitr' },
  { date: 'Week 8', historical: 0, predicted: 1550 },
  { date: 'Week 9', historical: 0, predicted: 1600 },
  { date: 'Week 10', historical: 0, predicted: 1700 },
  { date: 'Week 11', historical: 0, predicted: 2400, isHoliday: true, holidayName: 'New Year' },
  { date: 'Week 12', historical: 0, predicted: 1800 },
];

export const restockRecommendations: RestockRecommendation[] = [
  {
    productId: '2',
    productName: 'Coffee Mug',
    currentStock: 3,
    predictedDemand: 85,
    recommendedRestock: 82,
    urgency: 'high',
  },
  {
    productId: '7',
    productName: 'Desk Lamp',
    currentStock: 12,
    predictedDemand: 45,
    recommendedRestock: 33,
    urgency: 'high',
  },
  {
    productId: '6',
    productName: 'Headphones',
    currentStock: 15,
    predictedDemand: 52,
    recommendedRestock: 37,
    urgency: 'medium',
  },
  {
    productId: '3',
    productName: 'Notebook A5',
    currentStock: 18,
    predictedDemand: 48,
    recommendedRestock: 30,
    urgency: 'medium',
  },
  {
    productId: '8',
    productName: 'Backpack',
    currentStock: 22,
    predictedDemand: 38,
    recommendedRestock: 16,
    urgency: 'low',
  },
];

export const criticalStockItems = mockProducts.filter((p) => p.stock < 5);