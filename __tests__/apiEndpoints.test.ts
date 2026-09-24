import { resolveApiEndpoints } from '../src/config/apiEndpoints';

it('uses exactly one HTTPS endpoint for the remote APK with no LAN fallback', () => {
  expect(
    resolveApiEndpoints('android', {
      mode: 'remote',
      remoteBaseUrl: 'https://demo.example.test/',
    }),
  ).toEqual(['https://demo.example.test']);
});
it.each([
  'http://demo.test',
  'https://user:pass@demo.test',
  'https://demo.test?token=abc',
  'https://demo.test/#fragment',
  'invalid',
])('rejects invalid remote configuration', remoteBaseUrl => {
  expect(() =>
    resolveApiEndpoints('android', { mode: 'remote', remoteBaseUrl }),
  ).toThrow();
});
it('keeps local development endpoints only in local mode', () => {
  expect(
    resolveApiEndpoints('android', { mode: 'local', remoteBaseUrl: '' }),
  ).toContain('http://10.0.2.2:3000');
  expect(() =>
    resolveApiEndpoints('android', { mode: 'remtoe', remoteBaseUrl: '' }),
  ).toThrow();
});
