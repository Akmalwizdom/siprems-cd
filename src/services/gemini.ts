import { PredictionResponse } from './api';

const AI_CHAT_ENDPOINT = 'http://localhost:8000/api/chat';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CommandAction {
  type: 'restock' | 'add_product' | 'delete_product' | 'update_stock' | 'none';
  productId?: string;
  productName?: string;
  quantity?: number;
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

  constructor(aiChatEndpoint: string) {
    this.aiChatEndpoint = aiChatEndpoint;
  }

  async chat(
    message: string,
    predictionData: PredictionResponse | null,
    chatHistory: ChatMessage[]
  ): Promise<{ response: string; action: CommandAction }> {
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
      });

      if (!response.ok) {
        throw new Error(`AI Gateway error: ${response.statusText}`);
      }

      const data: ChatResponsePayload = await response.json();

      return {
        response: data.response,
        action: data.action
      };
    } catch (error) {
      console.error('AI Gateway error:', error);
      return {
        response: 'Maaf, terjadi kesalahan saat menghubungi layanan AI. Silakan coba lagi.',
        action: {
          type: 'none',
          needsConfirmation: false
        }
      };
    }
  }
}

export const geminiService = new GeminiService(AI_CHAT_ENDPOINT);
