// Isolated planning-sync QA server. No fallback to stable or production endpoints.
export const resolveApiEndpoints = (platform: string): string[] =>
  [platform === 'android' ? 'http://10.0.2.2:3303' : 'http://127.0.0.1:3303'];
