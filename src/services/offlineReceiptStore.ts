import RNFS from 'react-native-fs';

export type PendingReceipt = {
  path: string;
  name: string;
  type: string;
  size: number;
  sha256: string;
};

export type ReceiptSource = { uri: string; name: string; type: string };

const root = `${RNFS.DocumentDirectoryPath}/pending-receipts`;
const maxSize = 10 * 1024 * 1024;
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const decodeBase64Prefix = (encoded: string) => {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const character of encoded) {
    if (character === '=') break;
    const digit = alphabet.indexOf(character);
    if (digit < 0) continue;
    value = value * 64 + digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push(Math.floor(value / 2 ** bits) % 256);
      value %= 2 ** bits;
    }
  }
  return bytes;
};

const imageType = (bytes: number[]) => {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return 'image/png';
  if (bytes.length >= 3 && [255, 216, 255].every((v, i) => bytes[i] === v))
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    [82, 73, 70, 70].every((v, i) => bytes[i] === v) &&
    [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v)
  )
    return 'image/webp';
  throw Error('Ảnh hóa đơn chỉ hỗ trợ JPG, PNG hoặc WEBP.');
};

const destinationFor = (userId: number, requestId: string, type: string) => {
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)
  )
    throw Error('Mã ảnh hóa đơn chưa hợp lệ.');
  const extension = extensions[type];
  if (!extension) throw Error('Ảnh hóa đơn chỉ hỗ trợ JPG, PNG hoặc WEBP.');
  return `${root}/${userId}/${requestId}.${extension}`;
};

const withinRoot = (userId: number, receipt: PendingReceipt) =>
  receipt.path.startsWith(`${root}/${userId}/`) &&
  !receipt.path.slice(root.length).includes('..');

export const offlineReceiptStore = {
  async stage(userId: number, requestId: string, source: ReceiptSource) {
    destinationFor(userId, requestId, 'image/png');
    const temporary = `${root}/${userId}/${requestId}.tmp`;
    await RNFS.mkdir(`${root}/${userId}`);
    try {
      const sourcePath = source.uri.startsWith('file://')
        ? source.uri.slice('file://'.length)
        : source.uri;
      await RNFS.copyFile(sourcePath, temporary);
      const stat = await RNFS.stat(temporary);
      const size = Number(stat.size);
      if (!Number.isSafeInteger(size) || size <= 0 || size > maxSize)
        throw Error('Ảnh hóa đơn cần nhỏ hơn 10 MB.');
      const type = imageType(
        decodeBase64Prefix(await RNFS.read(temporary, 12, 0, 'base64')),
      );
      const path = destinationFor(userId, requestId, type);
      const sha256 = await RNFS.hash(temporary, 'sha256');
      await RNFS.moveFile(temporary, path);
      const name = `${
        source.name.replace(/[\\/]/g, '_').replace(/\.[^.]+$/, '') || 'receipt'
      }.${extensions[type]}`;
      return {
        path,
        name,
        type,
        size,
        sha256,
      } satisfies PendingReceipt;
    } catch (error) {
      if (await RNFS.exists(temporary).catch(() => false))
        await RNFS.unlink(temporary).catch(() => undefined);
      throw error;
    }
  },
  async verify(userId: number, receipt: PendingReceipt) {
    if (!withinRoot(userId, receipt) || !(await RNFS.exists(receipt.path)))
      throw Error(
        'Ảnh hóa đơn trên máy không còn. Chưa gửi giao dịch lên máy chủ.',
      );
    const stat = await RNFS.stat(receipt.path);
    const sha256 = await RNFS.hash(receipt.path, 'sha256');
    if (Number(stat.size) !== receipt.size || sha256 !== receipt.sha256)
      throw Error(
        'Ảnh hóa đơn trên máy đã thay đổi. Chưa gửi giao dịch lên máy chủ.',
      );
  },
  uploadFile(receipt: PendingReceipt) {
    return {
      uri: `file://${receipt.path}`,
      name: receipt.name,
      type: receipt.type,
    };
  },
  async remove(userId: number, receipt: PendingReceipt) {
    if (withinRoot(userId, receipt) && (await RNFS.exists(receipt.path)))
      await RNFS.unlink(receipt.path);
  },
};
