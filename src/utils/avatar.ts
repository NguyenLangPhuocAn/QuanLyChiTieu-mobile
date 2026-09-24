import { resolveUploadedMediaUrl } from './mediaUrls';

export const resolveAvatarUrl = (avatar?: string | null) =>
  resolveUploadedMediaUrl(avatar, 'avatars');
