const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = 'release/android-rc-readiness.json';
if (!fs.existsSync(path)) throw new Error('BLOCKED: independently verified Android RC readiness evidence is absent');
const evidence = JSON.parse(fs.readFileSync(path, 'utf8'));
if (evidence.status !== 'verified') throw new Error('BLOCKED: Android RC is not verified');
for (const check of ['originalBinaryCompatibility', 'criticalUserFlows', 'liveBaselinePreserved', 'noFalseCallOrPttIndicators']) {
  if (evidence.checks?.[check] !== 'passed') throw new Error('BLOCKED: missing verified ' + check);
}
for (const path of ['src', 'assets', 'index.js', 'app.config.js', 'package.json', 'package-lock.json']) {
  const object = execFileSync('git', ['rev-parse', 'HEAD:' + path], { encoding: 'utf8' }).trim();
  if (evidence.sourceObjects?.[path] !== object) throw new Error('BLOCKED: readiness evidence is stale for ' + path);
}
console.log('Android functional and original-binary compatibility evidence matches source.');
