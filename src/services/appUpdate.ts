import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

export const APP_UPDATE_MANIFEST_URL =
  'https://github.com/NguyenLangPhuocAn/QuanLyChiTieu-mobile/releases/latest/download/update.json';

export type AppUpdateManifest = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  notes: string;
  required: boolean;
  publishedAt?: string;
};

type VersionInfo = {
  versionCode: number;
  versionName: string;
};

type AppUpdateNativeModule = {
  getVersionInfo: () => Promise<VersionInfo>;
  canInstallPackages: () => Promise<boolean>;
  openInstallPermission: () => Promise<void>;
  installApk: (filePath: string) => Promise<void>;
};

const nativeUpdate = NativeModules.AppUpdate as AppUpdateNativeModule | undefined;

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export const parseUpdateManifest = (value: unknown): AppUpdateManifest => {
  const data = value as Partial<AppUpdateManifest> | null;
  const versionCode = Number(data?.versionCode);
  const versionName = String(data?.versionName ?? '').trim();
  const apkUrl = String(data?.apkUrl ?? '').trim();
  const sha256 = String(data?.sha256 ?? '').trim().toUpperCase();
  const notes = String(data?.notes ?? '').trim();

  if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
    throw new Error('Mã phiên bản cập nhật không hợp lệ.');
  }
  if (!versionName || !isHttpsUrl(apkUrl)) {
    throw new Error('Thông tin bản cập nhật không hợp lệ.');
  }
  if (!/^[0-9A-F]{64}$/.test(sha256)) {
    throw new Error('Mã kiểm tra file cập nhật không hợp lệ.');
  }

  return {
    versionCode,
    versionName,
    apkUrl,
    sha256,
    notes: notes || 'Cải thiện tính ổn định và trải nghiệm sử dụng.',
    required: data?.required === true,
    publishedAt:
      typeof data?.publishedAt === 'string' ? data.publishedAt : undefined,
  };
};

export const isNewerVersion = (
  currentVersionCode: number,
  nextVersionCode: number,
) => nextVersionCode > currentVersionCode;

const fetchManifest = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${APP_UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Không tải được thông tin cập nhật (${response.status}).`);
    }
    return parseUpdateManifest(await response.json());
  } finally {
    clearTimeout(timeout);
  }
};

export const appUpdateService = {
  isSupported() {
    return Platform.OS === 'android' && Boolean(nativeUpdate?.getVersionInfo);
  },

  async getVersionInfo() {
    if (!nativeUpdate) throw new Error('Thiết bị không hỗ trợ cập nhật trực tiếp.');
    return nativeUpdate.getVersionInfo();
  },

  async check(): Promise<AppUpdateManifest | null> {
    if (!this.isSupported()) return null;
    const [current, manifest] = await Promise.all([
      this.getVersionInfo(),
      fetchManifest(),
    ]);
    return isNewerVersion(current.versionCode, manifest.versionCode)
      ? manifest
      : null;
  },

  async canInstallPackages() {
    if (!nativeUpdate) return false;
    return nativeUpdate.canInstallPackages();
  },

  async openInstallPermission() {
    if (!nativeUpdate) throw new Error('Thiết bị không hỗ trợ cập nhật trực tiếp.');
    return nativeUpdate.openInstallPermission();
  },

  async download(
    manifest: AppUpdateManifest,
    onProgress: (percent: number) => void,
  ) {
    const directory = `${RNFS.DocumentDirectoryPath}/app-updates`;
    const destination = `${directory}/QuanLyChiTieu-${manifest.versionCode}.apk`;
    await RNFS.mkdir(directory);
    if (await RNFS.exists(destination)) await RNFS.unlink(destination);

    const task = RNFS.downloadFile({
      fromUrl: manifest.apkUrl,
      toFile: destination,
      progressDivider: 1,
      progress: event => {
        if (event.contentLength <= 0) return;
        onProgress(
          Math.min(100, Math.round((event.bytesWritten / event.contentLength) * 100)),
        );
      },
    });
    const result = await task.promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`Tải bản cập nhật thất bại (${result.statusCode}).`);
    }

    const actualHash = (await RNFS.hash(destination, 'sha256')).toUpperCase();
    if (actualHash !== manifest.sha256) {
      await RNFS.unlink(destination).catch(() => undefined);
      throw new Error('File cập nhật không vượt qua bước kiểm tra an toàn.');
    }
    onProgress(100);
    return destination;
  },

  async install(filePath: string) {
    if (!nativeUpdate) throw new Error('Thiết bị không hỗ trợ cập nhật trực tiếp.');
    return nativeUpdate.installApk(filePath);
  },
};
