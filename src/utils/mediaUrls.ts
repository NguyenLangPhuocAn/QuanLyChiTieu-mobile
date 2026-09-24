import { getApiBaseUrl } from '../services/api';

export const resolveUploadedMediaUrl = (
  value: string | null | undefined,
  folder: 'avatars' | 'receipts',
) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.replace(/^\/+/, '');
  const resource = path.startsWith('uploads/')
    ? path
    : `uploads/${folder}/${path}`;
  return `${getApiBaseUrl()}/${resource}`;
};

export const resolveReceiptUrl = (receipt?: string | null) =>
  resolveUploadedMediaUrl(receipt, 'receipts');
