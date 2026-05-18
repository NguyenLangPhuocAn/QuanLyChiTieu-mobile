import { apiRequest } from './api';
import type { TagItem } from '../types/tag';

export const tagsService = {
  getAll(token: string) {
    return apiRequest<TagItem[]>('/tags', {
      method: 'GET',
      token,
    });
  },

  create(token: string, name: string) {
    return apiRequest<TagItem[]>('/tags', {
      method: 'POST',
      token,
      body: { name },
    });
  },

  update(token: string, id: number, name: string) {
    return apiRequest<TagItem[]>(`/tags/${id}`, {
      method: 'PUT',
      token,
      body: { name },
    });
  },

  remove(token: string, id: number) {
    return apiRequest<TagItem[]>(`/tags/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  merge(token: string, id: number, targetName: string) {
    return apiRequest<TagItem[]>(`/tags/${id}/merge`, {
      method: 'POST',
      token,
      body: { targetName },
    });
  },
};
