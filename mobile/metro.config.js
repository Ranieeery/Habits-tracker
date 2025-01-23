const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.reporter = {
  update: () => {},
  log: () => {}
};

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer.minifierConfig,
    mangle: { toplevel: true },
    compress: { drop_console: true }
  }
};

module.exports = config;