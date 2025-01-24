const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './styles/global.css' })

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