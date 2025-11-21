// API Service for SIPREMS Backend Integration

const API_BASE_URL = 'http://localhost:8000/api';

export interface CalendarEvent {
  date: string;
  type: 'promotion' | 'holiday' | 'store-closed';
  title?: string;
}

export interface PredictionRequest {
  events: CalendarEvent[];
  store_config: {
    CompetitionDistance: number;
  };
}

export interface PredictionResponse {
  status: string;
  chartData: Array<{
    date: string;
    historical: number | null;
    predicted: number | null;
    isHoliday: boolean;
    holidayName?: string;
  }>;
  recommendations: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    predictedDemand: number;
    recommendedRestock: number;
    urgency: 'high' | 'medium' | 'low';
  }>;
  meta: {
    applied_factor: number;
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
    storeConfig?: { CompetitionDistance: number }
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
}

export const apiService = new ApiService(API_BASE_URL);
