/** BUKLOD_V25_INPLACE_ROUTER_FIX_R3: project-root Expo Router context, no external Metro adapter. */
'use strict';
const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
// Historical V25 custom overrides are retained; original config lives in this same root.
const prior = require('./metro.buklod-router-prepatch.cjs');
if (!prior || typeof prior !== 'object') throw Error('Original Metro configuration is invalid');
const base = getDefaultConfig(__dirname);
const nodeModules = path.join(__dirname, 'node_modules');
const realNodeModules = fs.existsSync(nodeModules) ? fs.realpathSync(nodeModules) : nodeModules;
const config = {
  ...base,
  ...prior,
  projectRoot: __dirname,
  resolver: { ...base.resolver, ...(prior.resolver || {}) },
  transformer: {
    ...base.transformer,
    ...(prior.transformer || {}),
    unstable_allowRequireContext: true,
  },
  watchFolders: [...new Set([
    ...(base.watchFolders || []),
    ...(prior.watchFolders || []),
    ...(realNodeModules !== nodeModules ? [realNodeModules] : []),
  ])],
};
config.resolver.nodeModulesPaths = [...new Set([
  nodeModules,
  realNodeModules,
  ...(config.resolver.nodeModulesPaths || []),
])];
module.exports = config;

/* BUKLOD_V25_DOM_CROSSDRIVE_RESOLVER_R5
 * Fix Expo DOM's generated "./D:/..." virtual import when Expo dependencies
 * live on C: and the BUKLOD project lives on D:. Restrict to expo/dom/entry.js,
 * web export, real files beneath the current project. No route or feature edits.
 */
const buklodDomR5PreviousResolver = module.exports.resolver.resolveRequest;
module.exports.resolver.resolveRequest = function buklodDomR5Resolve(context, moduleName, platform) {
  const origin = String(context.originModulePath || '').replace(/\\/g, '/');
  if (platform === 'web' && /\/expo\/dom\/entry\.js$/.test(origin) && /^\.\/[A-Za-z]:\//.test(moduleName)) {
    const candidate = path.win32.normalize(moduleName.substring(2).replace(/\//g, '\\'));
    const relative = path.win32.relative(path.win32.resolve(__dirname), candidate);
    if (!relative || relative === '..' || relative.startsWith('..\\') || path.win32.isAbsolute(relative)) {
      throw Error('BUKLOD DOM R5: refused import outside project: ' + moduleName);
    }
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
      throw Error('BUKLOD DOM R5: target missing: ' + candidate);
    }
    return { type: 'sourceFile', filePath: candidate };
  }
  if (typeof buklodDomR5PreviousResolver === 'function') {
    return buklodDomR5PreviousResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
