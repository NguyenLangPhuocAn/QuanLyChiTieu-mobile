import { API_BASE_URLS } from '../services/api';

export const resolveCategoryIconUrl = (icon?: string | null) => {
  if (!icon) {
    return null;
  }

  if (icon.startsWith('http://') || icon.startsWith('https://')) {
    return icon;
  }

  if (icon.startsWith('categories/icons/')) {
    return `${API_BASE_URLS[0]}/public/${icon}`;
  }

  return `${API_BASE_URLS[0]}/uploads/categories/${icon}`;
};
