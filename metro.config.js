const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaults = getDefaultConfig(__dirname);
const previous = defaults.resolver.blockList;
const config = {
  resolver: {
    blockList: [
      ...(Array.isArray(previous) ? previous : previous ? [previous] : []),
      // Native build tools create/delete temporary trees while Metro watches.
      // They contain no JS source and can trigger ENOENT on Windows.
      /[/\\]android[/\\](?:app[/\\])?(?:build|\.cxx|\.gradle)(?:[/\\]|$)/,
    ],
  },
};

module.exports = mergeConfig(defaults, config);
