const path = require('node:path');
const base = require('../metro.config');

// Explicit opt-in QA server; release configuration is never edited.
module.exports = {
  ...base,
  resolver: {
    ...base.resolver,
    resolveRequest(context, moduleName, platform) {
      if (moduleName.endsWith('/api.config.json')) {
        return { type: 'sourceFile', filePath: path.join(__dirname, 'api.local.json') };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};
