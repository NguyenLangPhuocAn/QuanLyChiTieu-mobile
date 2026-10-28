const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const config = require('./metro.bill-backup.cjs');
test('QA backup resolves only its explicit 3301 API module and keeps local config override', () => {
  const context = { resolveRequest: () => ({ original: true }) };
  const api = config.resolver.resolveRequest(context, '../config/apiEndpoints', 'android');
  assert.ok(api.filePath.endsWith('api.bill-backup.ts'));
  const source = fs.readFileSync(api.filePath, 'utf8');
  assert.match(source, /10\.0\.2\.2:3301/); assert.doesNotMatch(source, /10\.0\.2\.2:3000/);
  assert.ok(config.resolver.resolveRequest(context, '../api.config.json', 'android').filePath.endsWith('api.local.json'));
  assert.deepEqual(config.resolver.resolveRequest(context, 'unrelated', 'android'), { original: true });
});
