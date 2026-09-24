import type {
  ChatbotHistoryResponse,
  ChatbotResponse,
  ChatbotSuggestionsResponse,
  ChatbotConversationsResponse,
} from '../types/chatbot';
import { apiRequest } from './api';

export const chatbotService = {
  conversations(token: string, limit = 20, cursor?: string | null) {
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    return apiRequest<ChatbotConversationsResponse>(
      `/chatbot/conversations?limit=${limit}${cursorQuery}`,
      { token },
    );
  },
  history(token: string, limit = 30, beforeId?: number | null) {
    const cursorQuery = beforeId ? `&before_id=${beforeId}` : '';
    return apiRequest<ChatbotHistoryResponse>(
      `/chatbot/messages?limit=${limit}${cursorQuery}`,
      { token },
    );
  },
  conversationHistory(
    token: string,
    conversationId: number,
    limit = 30,
    beforeId?: number | null,
  ) {
    const cursorQuery = beforeId ? `&before_id=${beforeId}` : '';
    return apiRequest<ChatbotHistoryResponse>(
      `/chatbot/conversations/${conversationId}/messages?limit=${limit}${cursorQuery}`,
      { token },
    );
  },
  suggestions(token: string) {
    return apiRequest<ChatbotSuggestionsResponse>('/chatbot/suggestions', {
      token,
      timeoutMs: 35_000,
    });
  },
  send(
    token: string,
    message: string,
    conversationId?: number | null,
  ) {
    return apiRequest<ChatbotResponse>('/chatbot/messages', {
      method: 'POST',
      token,
      timeoutMs: 35_000,
      body: {
        ...(conversationId ? { conversation_id: conversationId } : {}),
        message,
      },
    });
  },
};
