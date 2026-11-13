const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const config = require('./metro.local.cjs');
test('QA Metro routes API config and endpoint to the isolated server', () => {
  const resolver = config.resolver.resolveRequest;
  const redirected = resolver({}, '../config/api.config.json', 'android');
  assert.equal(redirected.type, 'sourceFile');
  assert.deepEqual(JSON.parse(fs.readFileSync(redirected.filePath, 'utf8')), {
    mode: 'local',
    remoteBaseUrl: '',
  });
  const endpoint = resolver({}, '../config/apiEndpoints', 'android');
  assert.equal(endpoint.type, 'sourceFile');
  const source = fs.readFileSync(endpoint.filePath, 'utf8');
  assert.match(source, /localhost:3303/);
  assert.doesNotMatch(source, /:3000/);
  let received;
  const fallback = {
    resolveRequest(...args) {
      received = args;
      return 'normal module';
    },
  };
  assert.equal(resolver(fallback, 'react-native', 'android'), 'normal module');
  assert.deepEqual(received, [fallback, 'react-native', 'android']);
});
test('production API configuration remains remote', () => {
  const config = JSON.parse(
    fs.readFileSync(require.resolve('../src/config/api.config.json'), 'utf8'),
  );
  assert.equal(config.mode, 'remote');
  assert.match(config.remoteBaseUrl, /^https:\/\//);
});
test('QA bundle download uses the supported plain response without changing other requests', () => {
  const middleware = config.server.enhanceMiddleware(
    request => request.headers.accept,
    {},
  );
  const bundle = {
    url: '/index.bundle?platform=android',
    headers: { accept: 'multipart/mixed' },
  };
  assert.equal(
    middleware(bundle, {}, () => {}),
    'application/javascript',
  );
  const asset = { url: '/assets/icon.png', headers: { accept: 'image/png' } };
  assert.equal(
    middleware(asset, {}, () => {}),
    'image/png',
  );
});
