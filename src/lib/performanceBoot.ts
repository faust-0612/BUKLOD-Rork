/*
 * BUKLOD PERF-1
 *
 * Keep warnings/errors available.
 * Remove noisy informational console traffic
 * from production runtime.
 */

declare const __DEV__: boolean;

if (
  typeof __DEV__ !== 'undefined' &&
  !__DEV__
) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}
