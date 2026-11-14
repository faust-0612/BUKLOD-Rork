#!/usr/bin/env node
/**
 * Read-only route audit for BUKLOD Navigation V2. No generated routes, no
 * implicit permissions: every link still passes its existing authorization.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUKLOD_FEATURE_LINKS } from '../src/lib/buklodNavigationV2.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NATIVE_EXTENSIONS = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

export function resolveNavigationRoute(root, href) {
  if (typeof href !== 'string' || !/^\/[a-z0-9][a-z0-9/_-]*$/i.test(href)) return null;
  if (href.split('/').some(part => part === '.' || part === '..')) return null;
  const bases = [
    path.join(root, 'src', 'app' + href),
    path.join(root, 'src', 'app', '(tabs)' + href),
  ];
  for (const base of bases) {
    for (const extension of NATIVE_EXTENSIONS) {
      const resolved = base + extension;
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return path.relative(root, resolved).replaceAll(path.sep, '/');
      }
    }
  }
  return null;
}

export function inspectNavigationRoutes(root = ROOT) {
  const failures = [];
  const source = fs.readFileSync(path.join(root,'src/app/settings/index.tsx'),'utf8');
  const settingRoutes = Array.from(source.matchAll(/route:\s*'([^']+)'/g),x=>x[1]);
  const links = BUKLOD_FEATURE_LINKS.map(x=>x.route);
  const checked = Array.from(new Set([...settingRoutes, ...links]));
  if (!checked.length || settingRoutes.length < 8) failures.push('Settings feature registry unexpectedly empty');
  if (!links.includes('/settings') || !links.includes('/buklod') || !links.includes('/messages'))
    failures.push('Canonical navigation destinations missing');
  for (const href of checked) {
    if (!resolveNavigationRoute(root, href)) failures.push('Broken BUKLOD Navigation V2 route: ' + href);
  }
  const forbidden = links.filter(href => /^\/(?:admin|system|igpat)(?:\/|$)/i.test(href));
  if (forbidden.length) failures.push('Retired/admin destinations in feature finder: ' + forbidden.join(','));
  if (new Set(BUKLOD_FEATURE_LINKS.map(x=>x.id)).size !== BUKLOD_FEATURE_LINKS.length)
    failures.push('Duplicate feature IDs');
  return { ok: failures.length === 0, failures,
    checkedUniqueRoutes: checked.length,
    indexedFeatureDestinations: BUKLOD_FEATURE_LINKS.length,
    settingsEntries: settingRoutes.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = inspectNavigationRoutes();
  console.log(JSON.stringify({schema:'buklod-navigation-v2-route-audit-v1',...result},null,2));
  if (!result.ok) process.exitCode = 1;
}
