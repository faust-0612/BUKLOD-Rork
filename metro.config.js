const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

const blockPatterns = [
  /[/\\]BUKLOD_PLAYSTORE_ARCHIVE_CHECK[/\\].*/,
  /[/\\]BUKLOD_STREAM_WEB_BACKUP[^/\\]*[/\\].*/,
  /[/\\]BUKLOD_ANDROID_OTA_PREFLIGHT[/\\].*/,
  /[/\\]release[/\\]execution[/\\].*/,
  /\.bak$/,
  /\.before-[^/\\]+\.bak$/,
  /\.before_[^/\\]+$/,
  /[/\\]supabase[/\\]tests[/\\].*/,
  /[/\\]node_modules[/\\]typescript[/\\]lib[/\\].*\.d\.ts$/,
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...blockPatterns,
];

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    (moduleName === 'react-native-maps' ||
      moduleName.startsWith('react-native-maps/'))
  ) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/lib/buklodMapsWebStub.tsx'),
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.transformer = {
  ...config.transformer,
  minifierConfig: {
  ...(config.transformer?.minifierConfig ?? {}),
    keep_fnames: false,
    mangle: {
      ...(config.transformer?.minifierConfig?.mangle ?? {}),
      toplevel: true,
    },
    compress: {
      ...(config.transformer?.minifierConfig?.compress ?? {}),
      reduce_funcs: true,
      unused: true,
    },
  },
};

module.exports = config;
