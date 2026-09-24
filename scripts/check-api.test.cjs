const { test } = require('node:test');
const assert = require('node:assert/strict');
const { healthUrl, checkApi } = require('./check-api.cjs');

test('checks the configured health endpoint without sending login credentials', async () => {
  const result = await checkApi('https://test.example/api/', async (url, options) => {
    assert.equal(url, 'https://test.example/api/health');
    assert.equal(options.method, 'GET');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    assert.equal(options.redirect, 'error');
    return { ok: true, json: async () => ({ status: 'ok', service: 'quan-ly-chi-tieu' }) };
  });
  assert.match(result, /kiểm tra database/);
});

test('rejects a tunnel HTML page and a different service even when HTTP is 200', async () => {
  await assert.rejects(checkApi('https://test.example', async () => ({ ok: true, json: async () => { throw new SyntaxError(); } })), /không phải JSON/);
  await assert.rejects(checkApi('https://test.example', async () => ({ ok: true, json: async () => ({ status: 'ok' }) })), /không phải health endpoint/);
});

test('reports unreachable servers and HTTP failures without logging response content', async () => {
  await assert.rejects(checkApi('https://test.example', async () => { throw new TypeError('sensitive connection details'); }), /Không kết nối được backend/);
  await assert.rejects(checkApi('https://test.example', async () => ({ ok: false, status: 503 })), /HTTP 503/);
});

test('rejects credential-bearing and non-HTTP URLs before making a request', () => {
  for (const value of ['file:///secret', 'https://user:password@test.example', 'https://test.example?token=secret', 'bad-url']) {
    assert.throws(() => healthUrl(value));
  }
});
