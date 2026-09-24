export const resolveApiEndpoints = (
  platform: string,
  config: { mode: string; remoteBaseUrl: string },
): string[] => {
  if (config.mode === 'remote') {
    const url = new URL(config.remoteBaseUrl);
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'Cấu hình API từ xa phải là URL HTTPS, không chứa thông tin đăng nhập hoặc query.',
      );
    }
    return [url.toString().replace(/\/+$/, '')];
  }
  if (config.mode !== 'local') throw new Error('Chế độ API không hợp lệ.');
  return platform === 'android'
    ? [
        'http://10.0.2.2:3000',
        'http://192.168.1.3:3000',
        'http://localhost:3000',
      ]
    : ['http://localhost:3000', 'http://192.168.1.3:3000'];
};
