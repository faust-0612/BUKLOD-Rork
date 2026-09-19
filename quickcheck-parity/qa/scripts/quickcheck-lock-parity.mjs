import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const root = lock?.packages?.[''];

if (!root) throw new Error('package-lock root metadata missing.');
if (root.name !== pkg.name) throw new Error(`lock root name mismatch: ${root.name} != ${pkg.name}`);
if (root.version !== pkg.version) throw new Error(`lock root version mismatch: ${root.version} != ${pkg.version}`);

const normalize = value => JSON.stringify(value || {});
if (normalize(root.dependencies) !== normalize(pkg.dependencies)) {
  throw new Error('package-lock root dependencies do not match package.json.');
}
if (normalize(root.devDependencies) !== normalize(pkg.devDependencies)) {
  throw new Error('package-lock root devDependencies do not match package.json.');
}

console.log(JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  lockfileVersion: lock.lockfileVersion,
  productionDependencies: Object.keys(pkg.dependencies || {}).length,
  devDependencies: Object.keys(pkg.devDependencies || {}).length,
}, null, 2));
console.log('QUICKCHECK_PACKAGE_LOCK_PARITY_PASS');
