import { apiRequest, apiUploadRequest } from './api';
import type {
  ApiCategoryCashFlowGroup,
  ApiCategoryType,
  Category,
} from '../types/category';

export const categoriesService = {
  getAll(token: string) {
    return apiRequest<Category[]>('/categories', {
      method: 'GET',
      token,
    });
  },

  create(
    token: string,
    payload: {
      name: string;
      type: ApiCategoryType;
      cash_flow_group?: ApiCategoryCashFlowGroup;
      client_request_id?: string;
    },
  ) {
    return apiRequest<Category>('/categories', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  update(
    token: string,
    id: number,
    payload: {
      name?: string;
      type?: ApiCategoryType;
      cash_flow_group?: ApiCategoryCashFlowGroup;
      offline_expected?: {
        name: string;
        type: ApiCategoryType;
        cash_flow_group: ApiCategoryCashFlowGroup;
        icon: string | null;
      };
    },
  ) {
    return apiRequest<Category>(`/categories/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    });
  },

  remove(
    token: string,
    id: number,
    expected?: {
      name: string;
      type: ApiCategoryType;
      cash_flow_group: ApiCategoryCashFlowGroup;
      icon: string | null;
    },
  ) {
    return apiRequest<Category>(`/categories/${id}`, {
      method: 'DELETE',
      token,
      ...(expected ? { body: { offline_expected: expected } } : {}),
    });
  },

  uploadIcon(
    token: string,
    id: number,
    file: {
      uri: string;
      name: string;
      type: string;
    },
  ) {
    return apiUploadRequest<Category>(`/categories/${id}/icon`, token, file);
  },
};
