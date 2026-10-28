const path = require('node:path');
const local = require('./metro.local.cjs');
module.exports = {
  ...local,
  resolver: {
    ...local.resolver,
    resolveRequest(context, name, platform) {
      if (name.endsWith('/apiEndpoints')) return { type: 'sourceFile', filePath: path.join(__dirname, 'api.bill-backup.ts') };
      return local.resolver.resolveRequest(context, name, platform);
    },
  },
};
