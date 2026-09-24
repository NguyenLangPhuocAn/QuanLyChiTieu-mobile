import {
  API_BASE_URLS,
  apiRequest,
  configureAuthSession,
} from '../src/services/api';
import { resolveReceiptUrl } from '../src/utils/mediaUrls';
import { resolveAvatarUrl } from '../src/utils/avatar';

afterEach(() => {
  configureAuthSession(null);
  jest.restoreAllMocks();
});

it.each([
  'bill.jpg',
  'uploads/receipts/bill.jpg',
  '/uploads/receipts/bill.jpg',
])('resolves receipt %s without duplicating the upload prefix', value => {
  expect(resolveReceiptUrl(value)).toBe(
    `${API_BASE_URLS[0]}/uploads/receipts/bill.jpg`,
  );
});

it('uses the working API origin for avatars and receipts after LAN fallback', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '[]',
    } as Response);
  await apiRequest('/wallets');
  expect(resolveReceiptUrl('bill.jpg')).toBe(
    `${API_BASE_URLS[1]}/uploads/receipts/bill.jpg`,
  );
  expect(resolveAvatarUrl('me.jpg')).toBe(
    `${API_BASE_URLS[1]}/uploads/avatars/me.jpg`,
  );
  configureAuthSession(null);
  expect(resolveAvatarUrl('me.jpg')).toBe(
    `${API_BASE_URLS[0]}/uploads/avatars/me.jpg`,
  );
});

it('keeps external images and treats blank paths as missing images', () => {
  expect(resolveAvatarUrl(' https://images.example.test/me.jpg ')).toBe(
    'https://images.example.test/me.jpg',
  );
  expect(resolveReceiptUrl('   ')).toBeNull();
  expect(resolveAvatarUrl(null)).toBeNull();
});
