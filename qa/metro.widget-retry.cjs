const path = require('node:path');
const base = require('./metro.widget-loan.cjs');
const wrapper = path.join(__dirname, 'homeWidget.close-once.ts');
module.exports = {
  ...base,
  resolver: {
    ...base.resolver,
    resolveRequest(context, name, platform) {
      if (name.endsWith('/native/homeWidget') && context.originModulePath !== wrapper)
        return { type: 'sourceFile', filePath: wrapper };
      return base.resolver.resolveRequest(context, name, platform);
    },
  },
};
