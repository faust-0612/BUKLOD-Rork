import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = p => new URL('../' + p, import.meta.url);
const read = p => readFileSync(file(p), 'utf8');
const bytes = p => readFileSync(file(p));

test('PWA icon is the byte-identical 512px canonical BUKLOD PNG', () => {
  const sha = p => createHash('sha256').update(bytes(p)).digest('hex');
  assert.equal(sha('assets/release/buklod-main-canonical.png'), sha('public/buklod-brand-r2-512.png'));
  const png=bytes('public/buklod-brand-r2-512.png');
  assert.equal(png.toString('hex',0,8), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),512);
  assert.equal(png.readUInt32BE(20),512);
  const manifest=JSON.parse(read('public/manifest.json').replace(/^\uFEFF/,''));
  assert.deepEqual(manifest.icons.map(x=>x.src),['/buklod-brand-r2-512.png']);
  assert.equal(manifest.icons[0].sizes,'512x512');
  assert.equal(existsSync(file('public/buklod-192.png')),false);
  assert.equal(existsSync(file('public/buklod-512.png')),false);
});

test('web favicon canonical, Android icon remains untouched', () => {
  const app=read('app.config.js');
  assert.match(app,/favicon: isClassroom[\s\S]{0,150}buklod-main-canonical\.png/);
  assert.match(app,/icon: isClassroom[\s\S]{0,150}assets\/release\/app-icon\.png/);
  assert.match(app,/foregroundImage: isClassroom[\s\S]{0,220}assets\/release\/app-icon\.png/);
  for(const p of ['public/index.html','src/app/+html.tsx']) {
    const s=read(p);
    assert.ok(s.includes('/buklod-brand-r2-512.png'),p);
    assert.doesNotMatch(s,/buklod-192\.png|buklod-512\.png|ZION/);
  }
});

test('all public and scoped desktop brand headers render canonical mark', () => {
  for(const p of ['src/components/BuklodPublicDesktopDashboard.tsx','src/components/BuklodDesktopWebShell.tsx','src/components/BuklodMainBrandIntro.web.tsx']) {
    assert.match(read(p),/buklod-main-canonical\.png/,p);
  }
  const scoped=read('src/components/BuklodDesktopWebShell.tsx');
  assert.doesNotMatch(scoped,/brandLetter|brandMark: \{/);
});

test('release does not invoke retired hotfix scripts or rewrite tracked source', () => {
  const workflow=read('.github/workflows/production_web_deploy.yml');
  for(const p of ['scripts/patch-web-community-post.cjs','scripts/patch-home-identity-action-row.cjs']) {
    assert.equal(existsSync(file(p)),false);
    assert.equal(workflow.includes(p),false);
  }
  assert.match(workflow,/Deny export-time tracked source mutations/);
  assert.match(workflow,/git diff --exit-code/);
  assert.match(workflow,/EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(workflow,/npx eas-cli@latest deploy --prod --export-dir dist/);
  assert.match(workflow,/github.ref == 'refs\/heads\/main'/);
});

test('web guide exit is source owned and native return-to-cluster survives', () => {
  const guide=read('src/components/BuklodGuideAvatar.tsx');
  assert.match(guide,/WEB_SCOPED_GUIDE_EXIT_SOURCE_R2/);
  assert.match(guide,/if \(Platform\.OS === 'web'\)/);
  assert.match(guide,/router\.replace\('\/me' as any\)/);
  assert.match(guide,/buildScopedWorkspacePath[\s\S]*?'home'/);
});
