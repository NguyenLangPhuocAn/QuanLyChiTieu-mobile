import { isNewerVersion, parseUpdateManifest } from '../src/services/appUpdate';

const validManifest = {
  versionCode: 3,
  versionName: '1.2.0',
  apkUrl:
    'https://github.com/NguyenLangPhuocAn/QuanLyChiTieu-mobile/releases/download/v1.2.0/QuanLyChiTieu-1.2.0.apk',
  sha256: 'a'.repeat(64),
  notes: 'Sửa lỗi và cải thiện tốc độ.',
  required: false,
};

describe('app update manifest', () => {
  it('accepts a signed HTTPS release manifest', () => {
    expect(parseUpdateManifest(validManifest)).toEqual({
      ...validManifest,
      sha256: 'A'.repeat(64),
    });
  });

  it('rejects an invalid checksum or non-HTTPS download', () => {
    expect(() =>
      parseUpdateManifest({ ...validManifest, sha256: 'abc' }),
    ).toThrow('Mã kiểm tra');
    expect(() =>
      parseUpdateManifest({ ...validManifest, apkUrl: 'http://example.test/app.apk' }),
    ).toThrow('Thông tin');
  });

  it('uses versionCode as the update authority', () => {
    expect(isNewerVersion(2, 3)).toBe(true);
    expect(isNewerVersion(3, 3)).toBe(false);
    expect(isNewerVersion(4, 3)).toBe(false);
  });
});
