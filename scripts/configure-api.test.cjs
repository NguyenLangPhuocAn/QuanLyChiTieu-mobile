const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configuration } = require('./configure-api.cjs');

test('prepares remote and local profiles without writing files', () => {
  assert.deepEqual(configuration(['--remote', 'https://demo.example.test/']), { mode: 'remote', remoteBaseUrl: 'https://demo.example.test' });
  assert.deepEqual(configuration(['--local']), { mode: 'local', remoteBaseUrl: '' });
});
test('rejects insecure or ambiguous arguments', () => {
  for (const args of [[], ['--remote'], ['--remote', 'http://demo.test'], ['--remote', 'https://user:pass@demo.test'], ['--remote', 'https://demo.test?token=x']]) {
    assert.throws(() => configuration(args));
  }
});
