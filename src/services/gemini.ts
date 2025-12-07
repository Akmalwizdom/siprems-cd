import { PredictionResponse } from './api';

const AI_CHAT_ENDPOINT = 'http://localhost:8000/api/chat';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CommandAction {
  type: 'restock' | 'bulk_restock' | 'add_product' | 'delete_product' | 'update_stock' | 'none';
  productId?: string | null;
  productName?: string | null;
  quantity?: number | null;
  needsConfirmation: boolean;
}

interface ChatRequestPayload {
  message: string;
  predictionData: PredictionResponse | null;
  chatHistory: ChatMessage[];
}

interface ChatResponsePayload {
  response: string;
  action: CommandAction;
}

class GeminiService {
  private aiChatEndpoint: string;
  private requestTimeout: number = 30000; // 30 seconds timeout

  constructor(aiChatEndpoint: string) {
    this.aiChatEndpoint = aiChatEndpoint;
  }

  private createSafeAction(action: unknown): CommandAction {
    const defaultAction: CommandAction = {
      type: 'none',
      productId: null,
      productName: null,
      quantity: null,
      needsConfirmation: false,
    };

    if (!action || typeof action !== 'object') {
      return defaultAction;
    }

    const a = action as Record<string, unknown>;
    
    // Validate action type
    const validTypes = ['restock', 'bulk_restock', 'add_product', 'delete_product', 'update_stock', 'none'];
    const actionType = typeof a.type === 'string' && validTypes.includes(a.type) 
      ? a.type as CommandAction['type']
      : 'none';

    return {
      type: actionType,
      productId: typeof a.productId === 'string' ? a.productId : null,
      productName: typeof a.productName === 'string' ? a.productName : null,
      quantity: typeof a.quantity === 'number' ? a.quantity : null,
      needsConfirmation: typeof a.needsConfirmation === 'boolean' ? a.needsConfirmation : false,
    };
  }

  async chat(
    message: string,
    predictionData: PredictionResponse | null,
    chatHistory: ChatMessage[]
  ): Promise<{ response: string; action: CommandAction }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const payload: ChatRequestPayload = {
        message,
        predictionData,
        chatHistory
      };

      const response = await fetch(this.aiChatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI Gateway error: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate response structure
      const safeResponse = typeof data?.response === 'string' && data.response.length > 0
        ? data.response
        : 'Maaf, tidak dapat memproses permintaan Anda saat ini.';
      
      const safeAction = this.createSafeAction(data?.action);

      return {
        response: safeResponse,
        action: safeAction
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('AI Gateway error:', error);
      
      // Handle specific error types
      let errorMessage = 'Maaf, terjadi kesalahan saat menghubungi layanan AI. Silakan coba lagi.';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Waktu permintaan habis. Silakan coba lagi.';
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
        }
      }

      return {
        response: errorMessage,
        action: {
          type: 'none',
          productId: null,
          productName: null,
          quantity: null,
          needsConfirmation: false
        }
      };
    }
  }
}

export const geminiService = new GeminiService(AI_CHAT_ENDPOINT);
