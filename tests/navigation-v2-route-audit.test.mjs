import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { inspectNavigationRoutes, resolveNavigationRoute } from '../scripts/navigation-v2-route-audit.mjs';

test('the actual current feature finder and settings links all point to real Expo Router screens', () => {
  const report = inspectNavigationRoutes();
  assert.equal(report.ok,true,report.failures.join('; '));
  assert.ok(report.checkedUniqueRoutes>=10);
  assert.ok(report.indexedFeatureDestinations>=10);
});
test('route resolution rejects dangerous paths and accepts canonical tabs/index', () => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-nav-v2-'));
  try {
    fs.mkdirSync(path.join(tmp,'src','app','(tabs)'),{recursive:true});
    fs.mkdirSync(path.join(tmp,'src','app','settings'),{recursive:true});
    fs.writeFileSync(path.join(tmp,'src','app','(tabs)','me.tsx'),'');
    fs.writeFileSync(path.join(tmp,'src','app','settings','index.tsx'),'');
    assert.equal(resolveNavigationRoute(tmp,'/me'),'src/app/(tabs)/me.tsx');
    assert.equal(resolveNavigationRoute(tmp,'/settings'),'src/app/settings/index.tsx');
    assert.equal(resolveNavigationRoute(tmp,'/admin/missing'),null);
    assert.equal(resolveNavigationRoute(tmp,'/../../secrets'),null);
  } finally {fs.rmSync(tmp,{recursive:true,force:true})}
});
