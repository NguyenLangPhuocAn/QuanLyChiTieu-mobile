export type ChatRole = 'user' | 'assistant';

export type ChatbotCategorySpending = {
  category_id: number;
  category: string;
  icon?: string | null;
  currency: string;
  amount: number;
};

export type ChatMessage = {
  id?: number | string;
  role: ChatRole;
  content: string;
  category_spending?: ChatbotCategorySpending[];
  context_window_days?: number | null;
  created_at?: string;
};

export type ChatbotHistoryResponse = {
  conversation?: ChatbotConversation;
  messages: ChatMessage[];
  has_more: boolean;
  next_cursor: number | null;
};

export type ChatbotConversation = {
  id: number;
  title: string;
  message_count: number;
  last_message?: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatbotConversationsResponse = {
  conversations: ChatbotConversation[];
  has_more: boolean;
  next_cursor: string | null;
};

export type ChatbotSuggestionsResponse = {
  suggestions: string[];
  generated_for: string;
  source: 'AI' | 'CACHE' | 'FALLBACK';
};

export type ChatbotResponse = {
  message: string;
  response_id?: string | null;
  model: string;
  generated_at: string;
  context_window_days: number;
  disclaimer: string;
  category_spending?: ChatbotCategorySpending[];
  conversation: ChatbotConversation;
  conversation_id: number;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};
