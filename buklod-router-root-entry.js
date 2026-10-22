/** BUKLOD_V25_LOCAL_ROUTER_CONTEXT_R4: Expo Router official manual root registration.
 * Catches Windows cross-volume node_modules junction: require.context lives in project D:.
 * Do not move routes, alter app modules, or mutate native code.
 */
'use strict';
const React = require('react');
const { registerRootComponent } = require('expo');
const { ExpoRoot } = require('expo-router');
function BuklodApp() {
  const ctx = require.context('./src/app');
  return React.createElement(ExpoRoot, { context: ctx });
}
registerRootComponent(BuklodApp);
