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
    train_mape?: number | null;
    validation_mape?: number | null;
    log_transform?: boolean;
    model_version?: string;
    model_saved_at?: string | null;
    validation_warnings?: string[];
    warning?: string;
    data_freshness?: {
      days_since_last_data: number;
      status: 'fresh' | 'recent' | 'stale' | 'very_stale';
      activity_ratio: number;
      recent_activity: number;
      previous_activity: number;
    };
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Restock failed: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: Database operation took too long');
      }
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(`${this.baseUrl}/products/${productId}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stock: newStock,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Update stock failed: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: Database operation took too long');
      }
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  async getForecastAccuracy(storeId: string = '1'): Promise<{ accuracy: number | null; model_version?: string; last_trained?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/forecast/accuracy?store_id=${storeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Get forecast accuracy failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting forecast accuracy:', error);
      return { accuracy: null };
    }
  }

  async getModelAccuracy(storeId: string = '1'): Promise<ModelAccuracyResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/model/accuracy?store_id=${storeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Get model accuracy failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting model accuracy:', error);
      return { 
        status: 'error', 
        accuracy: null, 
        train_mape: null,
        validation_mape: null,
        error_gap: null,
        fit_status: 'unknown'
      };
    }
  }
}

export interface DataFreshness {
  last_transaction_date: string | null;
  days_since_last_transaction: number | null;
  transactions_last_7_days: number;
  status: 'fresh' | 'recent' | 'stale' | 'very_stale' | 'no_data' | 'unknown';
}

export interface ModelAccuracyResponse {
  status: string;
  accuracy: number | null;
  train_mape: number | null;
  validation_mape: number | null;
  error_gap: number | null;
  fit_status: string;
  validation_days?: number;
  data_points?: number;
  model_version?: string;
  last_trained?: string;
  validation_details?: {
    dates: string[];
    actual: number[];
    predicted: number[];
  };
  message?: string;
  error?: string;
  warning?: string;
  data_freshness?: DataFreshness;
}

export const apiService = new ApiService(API_BASE_URL);
