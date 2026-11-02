export const resolveApiEndpoints = (platform: string): string[] =>
  [platform === 'android' ? 'http://10.0.2.2:3304' : 'http://127.0.0.1:3304'];
