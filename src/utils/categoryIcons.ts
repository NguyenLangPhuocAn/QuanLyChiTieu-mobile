import { API_BASE_URLS } from '../services/api';

export const resolveCategoryIconUrls = (icon?: string | null): string[] => {
  const value = icon?.trim();
  if (!value) return [];
  if (/^https?:\/\//i.test(value)) return [value];
  const path = value.replace(/^\/+/, '');
  const resource =
    path.startsWith('public/') || path.startsWith('uploads/')
      ? path
      : path.startsWith('categories/icons/')
      ? `public/${path}`
      : `uploads/categories/${path}`;
  return [...new Set(API_BASE_URLS.map(base => `${base}/${resource}`))];
};

export const resolveCategoryIconUrl = (icon?: string | null) =>
  resolveCategoryIconUrls(icon)[0] ?? null;
