import { apiRequest } from './api';
import type { NotificationSettings, PaginatedNotifications } from '../types/notification';

export const notificationsService = {
  getAll(token: string, page = 1) {
    return apiRequest<PaginatedNotifications>(`/notifications?page=${page}&limit=20`, {
      method: 'GET',
      token,
    });
  },

  getUnreadCount(token: string) {
    return apiRequest<{ count: number }>('/notifications/unread-count', {
      method: 'GET',
      token,
    });
  },

  markRead(token: string, id: number) {
    return apiRequest<{ message: string }>(`/notifications/${id}/read`, {
      method: 'PUT',
      token,
    });
  },

  markAllRead(token: string) {
    return apiRequest<{ message: string }>('/notifications/read-all', {
      method: 'PUT',
      token,
    });
  },

  remove(token: string, id: number) {
    return apiRequest<{ message: string }>(`/notifications/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  getSettings(token: string) {
    return apiRequest<NotificationSettings>('/notifications/settings', {
      method: 'GET',
      token,
    });
  },

  updateSettings(token: string, payload: Partial<NotificationSettings>) {
    return apiRequest<NotificationSettings>('/notifications/settings', {
      method: 'PUT',
      token,
      body: payload,
    });
  },
};
