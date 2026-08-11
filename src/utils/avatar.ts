import { API_BASE_URLS } from '../services/api';

export const resolveAvatarUrl = (avatar?: string | null) => {
  if (!avatar) {
    return null;
  }

  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }

  if (avatar.startsWith('/uploads/')) {
    return `${API_BASE_URLS[0]}${avatar}`;
  }

  if (avatar.startsWith('uploads/')) {
    return `${API_BASE_URLS[0]}/${avatar}`;
  }

  return `${API_BASE_URLS[0]}/uploads/avatars/${avatar}`;
};
