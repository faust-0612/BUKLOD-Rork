import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('./kl-ts-loader.mjs', import.meta.url), import.meta.url);

const tests = [];
globalThis.describe = (_name, fn) => { fn(); };
globalThis.it = (name, fn) => { tests.push({ name, fn }); };
globalThis.expect = (actual) => {
  const api = {
    toBe: (expected) => assert.equal(actual, expected),
    toEqual: (expected) => assert.deepEqual(actual, expected),
    toBeNull: () => assert.equal(actual, null),
    toBeUndefined: () => assert.equal(actual, undefined),
    toBeGreaterThan: (expected) => assert.ok(actual > expected),
    toBeLessThan: (expected) => assert.ok(actual < expected),
    toHaveLength: (expected) => assert.equal(actual.length, expected),
    toContain: (expected) => assert.ok(actual.includes(expected), `missing ${expected}`),
    toMatch: (expected) => assert.match(String(actual), expected),
    toMatchObject: (partial) => {
      for (const key of Object.keys(partial)) {
        assert.deepEqual(actual[key], partial[key]);
      }
    },
  };
  api.not = {
    toContain: (expected) => assert.ok(!actual.includes(expected)),
    toMatch: (expected) => assert.doesNotMatch(String(actual), expected),
  };
  return api;
};

await import(new URL('../__tests__/kabihasnangLigawR5.test.ts', import.meta.url).href);

let failed = 0;
for (const test of tests) {
  try {
    await test.fn();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error);
  }
}
if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log(`${tests.length} passed`);
