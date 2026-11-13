// Only bundled by qa/metro.local.cjs. Never route emulator QA to port 3000.
export const resolveApiEndpoints = (_platform: string): string[] => [
  'http://localhost:3303',
];
