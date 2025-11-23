// API Service for SIPREMS Backend Integration

const API_BASE_URL = 'http://localhost:8000/api';

export interface CalendarEvent {
  date: string;
  type: 'promotion' | 'holiday' | 'store-closed' | 'event';
  title?: string;
  impact?: number;
}

export interface PredictionRequest {
  events: CalendarEvent[];
  store_config: {
    CompetitionDistance: number;
  };
  days?: number;
}

export interface PredictionResponse {
  status: string;
  chartData: Array<{
    date: string;
    historical: number | null;
    predicted: number | null;
    isHoliday: boolean;
    holidayName?: string;
    lower?: number;
    upper?: number;
  }>;
  recommendations: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    predictedDemand: number;
    recommendedRestock: number;
    urgency: 'high' | 'medium' | 'low';
    category?: string;
  }>;
  eventAnnotations: Array<{
    date: string;
    titles: string[];
    types: string[];
  }>;
  meta: {
    applied_factor: number;
    historicalDays?: number;
    forecastDays?: number;
    lastHistoricalDate?: string;
    regressors?: string[];
    accuracy?: number;
  };
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async trainModel(storeId: string, storeConfig?: { CompetitionDistance: number }): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/train/${storeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_config: storeConfig || { CompetitionDistance: 500 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Training failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error training model:', error);
      throw error;
    }
  }

  async getPrediction(
    storeId: string,
    events: CalendarEvent[],
    storeConfig?: { CompetitionDistance: number },
    days?: number
  ): Promise<PredictionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/predict/${storeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events,
          store_config: storeConfig || { CompetitionDistance: 500 },
          days: days || 84,
        }),
      });

      if (!response.ok) {
        throw new Error(`Prediction failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting prediction:', error);
      throw error;
    }
  }

  async restockProduct(productId: string, quantity: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/restock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity,
        }),
      });

      if (!response.ok) {
        throw new Error(`Restock failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error restocking product:', error);
      throw error;
    }
  }

  async addProduct(productData: { name: string; category?: string; initialStock: number }): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        throw new Error(`Add product failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Delete product failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  async updateStock(productId: string, newStock: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/products/${productId}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock: newStock,
        }),
      });

      if (!response.ok) {
        throw new Error(`Update stock failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService(API_BASE_URL);
