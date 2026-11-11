import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(path, 'utf8');

test('IGPAT native and web routes are retired without mounting old feed or upload workflows', () => {
  for (const path of [
    'src/app/igpat/index.tsx',
    'src/app/igpat/index.web.tsx',
    'src/app/igpat/create.tsx',
    'src/app/igpat/create.web.tsx',
  ]) {
    const file = source(path);
    const retirement = file.indexOf('export default function RetiredIgpatRoute()');
    const legacy = file.search(/\nfunction (IgpatScreen|IgpatWebScreen|IgpatCreateScreen|IgpatCreateWebScreen)\(/);
    assert.ok(retirement > -1, path + ': missing retired default');
    assert.ok(legacy > retirement, path + ': legacy component must not be exported');
    assert.match(file.slice(retirement, legacy), /return <Redirect href="\/buklod" \/>;/);
  }
  for (const path of ['src/app/reels/index.tsx', 'src/app/igpat/[id].tsx'])
    assert.match(source(path), /<Redirect href="\/buklod" \/>/);
});

test('Wall and Home no longer offer an IGPAT entry point', () => {
  for (const path of [
    'src/components/BuklodWallQuickLinks.tsx',
    'src/app/personal-home/media.tsx',
    'src/components/home/BuklodSpatialHomeV2.tsx',
    'src/components/home/BuklodPersonalHomeFunctional.tsx',
  ]) {
    assert.doesNotMatch(source(path), /IGPAT|\/igpat/i, path);
  }
  const links = source('src/components/BuklodWallQuickLinks.tsx');
  assert.match(links, /Community Wall/);
  assert.match(links, /Open 702 DZAS Radio/);
  assert.match(source('src/components/home/BuklodPersonalHomeFunctional.tsx'), /openRoute\('\/personal-home\/media'\)/);
});

test('Legacy preview mounts are inert on native and web', () => {
  for (const path of [
    'src/components/BuklodHomeReelsExtension.tsx',
    'src/components/BuklodCommunityIgpatPreview.android.tsx',
    'src/components/BuklodCommunityIgpatPreview.web.tsx',
  ]) {
    const file = source(path);
    const firstExport = file.indexOf('export default function RetiredIgpatPreview');
    const legacy = file.indexOf('function Buklod', firstExport + 1);
    assert.ok(firstExport >= 0 && legacy > firstExport, path);
    assert.match(file.slice(firstExport, legacy), /return null;/);
  }
});

test('Server write policy blocks fresh IGPAT only, without deleting historical records', () => {
  const sql = source('supabase/migrations/20261111151816_retire_igpat_preserve_history_v1.sql');
  assert.match(sql, /BEFORE INSERT OR UPDATE OF is_reel/);
  assert.match(sql, /NEW\.is_reel IS TRUE/);
  assert.match(sql, /OLD\.is_reel IS DISTINCT FROM TRUE/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION/);
  for (const name of ['create_buklod_reel_v1','create_buklod_reel_v2','create_buklod_reel_v3','get_buklod_igpat_feed_v4'])
    assert.ok(sql.includes(name), name);
  assert.doesNotMatch(sql, /\b(?:DELETE FROM|TRUNCATE|DROP TABLE|UPDATE public\.community_posts)\b/i);
  const wall = source('src/app/(tabs)/buklod.tsx');
  assert.match(wall, /!Boolean\(post\.is_reel\)/);
  assert.match(wall, /p_is_reel:false/);
});
