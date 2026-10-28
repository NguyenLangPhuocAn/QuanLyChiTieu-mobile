// Explicit QA resolver: never fall back to the production/local server on 3000.
export const resolveApiEndpoints = (platform: string): string[] =>
  [platform === 'android' ? 'http://10.0.2.2:3301' : 'http://127.0.0.1:3301'];
