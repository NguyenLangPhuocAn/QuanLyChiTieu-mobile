const path = require('node:path');
const base = require('../metro.config');

// Explicit opt-in QA server; release configuration is never edited.
module.exports = {
  ...base,
  server: {
    ...base.server,
    enhanceMiddleware(middleware, server) {
      const next = base.server?.enhanceMiddleware ? base.server.enhanceMiddleware(middleware, server) : middleware;
      return (req, res, done) => {
        // The emulator's OkHttp multipart downloader can fail on the local
        // progress stream. RN supports a plain bundle response too; QA only.
        if (req.url?.split('?')[0].endsWith('.bundle')) req.headers.accept = 'application/javascript';
        return next(req, res, done);
      };
    },
  },
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
