import RNFS from 'react-native-fs';
import { offlineReceiptStore } from '../offlineReceiptStore';

const fs = RNFS as jest.Mocked<typeof RNFS>;
const source = {
  uri: 'file:///temporary/photo.jpg',
  name: 'photo.jpg',
  type: 'image/jpeg',
};

describe('offlineReceiptStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.stat.mockResolvedValue({ size: 1250 } as never);
    fs.hash.mockResolvedValue('a'.repeat(64));
    fs.exists.mockResolvedValue(true);
  });

  it('copies a temporary picker image to persistent app storage and verifies it before upload', async () => {
    const saved = await offlineReceiptStore.stage(
      7,
      'txn_receipt_staged_12345',
      source,
    );
    expect(fs.copyFile).toHaveBeenCalledWith(
      '/temporary/photo.jpg',
      '/tmp/pending-receipts/7/txn_receipt_staged_12345.tmp',
    );
    expect(fs.moveFile).toHaveBeenCalledWith(
      '/tmp/pending-receipts/7/txn_receipt_staged_12345.tmp',
      saved.path,
    );
    expect(saved).toMatchObject({ size: 1250, sha256: 'a'.repeat(64) });
    await offlineReceiptStore.verify(7, saved);
    expect(offlineReceiptStore.uploadFile(saved).uri).toBe(
      `file://${saved.path}`,
    );
  });

  it('rejects an oversized image before adding it to the queue', async () => {
    fs.stat.mockResolvedValue({ size: 11 * 1024 * 1024 } as never);
    await expect(
      offlineReceiptStore.stage(7, 'txn_receipt_large_12345', source),
    ).rejects.toThrow('10 MB');
    expect(fs.moveFile).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('uses the actual file signature when the picker labels PNG content as JPG', async () => {
    fs.read.mockResolvedValueOnce('iVBORw0KGgoAAAAA');
    const saved = await offlineReceiptStore.stage(
      7,
      'txn_receipt_mislabeled_12345',
      source,
    );
    expect(saved).toMatchObject({
      type: 'image/png',
      name: 'photo.png',
    });
    expect(saved.path).toMatch(/\.png$/);
  });

  it('does not upload a changed or missing stored image', async () => {
    const saved = await offlineReceiptStore.stage(
      7,
      'txn_receipt_verify_12345',
      source,
    );
    fs.hash.mockResolvedValueOnce('b'.repeat(64));
    await expect(offlineReceiptStore.verify(7, saved)).rejects.toThrow(
      'đã thay đổi',
    );
    fs.exists.mockResolvedValueOnce(false);
    await expect(offlineReceiptStore.verify(7, saved)).rejects.toThrow(
      'không còn',
    );
  });
});
