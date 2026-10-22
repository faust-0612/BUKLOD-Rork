const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

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

// BUKLOD_EXPO_SQLITE_WEB_WASM_R1 — if any path still loads the worker, .wasm
// must resolve as a Metro asset (native Android never loads this file).
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

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

  // Smart Drawer imports expo-sqlite only after a native platform check, but
  // Metro still follows the dynamic import on web and then fails on
  // wa-sqlite.wasm. The website already uses AsyncStorage for drawer data.
  if (
    platform === 'web' &&
    (moduleName === 'expo-sqlite' || moduleName.startsWith('expo-sqlite/'))
  ) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/lib/expoSqliteWebStub.ts'),
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
