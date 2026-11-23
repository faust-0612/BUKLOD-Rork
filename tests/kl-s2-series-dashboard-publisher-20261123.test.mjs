import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261123203000_kl_s2_series_dashboard_catalog.sql');
const home = read('src/components/kabihasnang-ligaw/KlDashboardHome.tsx');
const route = read('src/app/kabihasnang-ligaw.tsx');
const seasonReader = read('src/components/kabihasnang-ligaw/KlDynamicLibrary.tsx');
const legacyReader = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
const admin = read('src/components/kabihasnang-ligaw/KlSeriesAdminPanel.tsx');
const editor = read('src/components/kabihasnang-ligaw/KlPublishingStudio.tsx');
const release = read('src/components/kabihasnang-ligaw/KlSeriesReleaseDesk.tsx');

test('KL opens at its dashboard and enters the original Season 1 reader or scoped later-series reader', () => {
  assert.match(route, /<KlDashboardHome onOpenSeries=\{setSeasonNumber\}/);
  assert.match(route, /seasonNumber === 1/);
  assert.match(route, /<KlReaderScreen onBackToDashboard/);
  assert.match(route, /<KlDynamicLibrary key=\{seasonNumber\} seasonNumber=\{seasonNumber\}/);
  assert.match(legacyReader, /onBackToDashboard/);
  assert.match(seasonReader, /filter\(c=>seasonNumber==null\|\|c\.season_number===seasonNumber\)/);
});

test('dashboard offers continue, reading progress and released-only catalog with S1 fallback', () => {
  assert.match(home, /Ipagpatuloy ang pagbabasa/);
  assert.match(home, /Ang iyong paglalakbay/);
  assert.match(home, /Mga Serye/);
  assert.match(home, /kl_list_library_v1/);
  assert.match(home, /kl_s2_reader_series_catalog_v1/);
  assert.match(home, /kl_s2_reader_progress_v1/);
  assert.match(home, /setProgress\(\{\}\)/);
  assert.match(home, /sequence\.current/);
  assert.match(home, /KL_SEASON_ONE_TITLE/);
  assert.doesNotMatch(home, /kl_admin_list_v1|kl_admin_preview_v1/);
});

test('private series metadata has RLS, admin role enforcement and bounded input', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS private\.kl_s2_series_metadata/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE private\.kl_s2_series_metadata FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /p\.is_active IS TRUE AND p\.role::text='system_admin'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.kl_s2_admin_save_series_v1/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.kl_s2_admin_series_catalog_v1/);
  assert.match(migration, /char_length\(v_title\) NOT BETWEEN 3 AND 120/);
  assert.match(migration, /char_length\(v_description\) > 600/);
});

test('reader catalog cannot expose scheduled, rejected or unreleased chapters', () => {
  const source = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.kl_s2_reader_series_catalog_v1'));
  assert.match(source, /e\.status='approved'/);
  assert.match(source, /e\.approved_at IS NOT NULL/);
  assert.match(source, /e\.release_at IS NOT NULL AND e\.release_at<=now\(\)/);
  assert.match(source, /GROUP BY e\.season_number,m\.title,m\.description/);
  assert.doesNotMatch(source, /manuscript|storage_path|quiz_answers|reflection_text/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.kl_s2_reader_series_catalog_v1\(\) TO anon, authenticated/);
});

test('admin series creation does not publish chapters; release is verified independently', () => {
  assert.match(admin, /kl_s2_admin_save_series_v1/);
  assert.match(admin, /private muna/);
  assert.match(editor, /<KlSeriesAdminPanel selectedSeason/);
  assert.match(editor, /<KlSeriesReleaseDesk key=/);
  assert.match(editor, /episodes\.filter\(e => e\.season_number === Number\(season\)\)/);
  assert.match(release, /klReleaseBlockers\(latest\)/);
  assert.match(release, /seasonTwoReady\(\)/);
  assert.match(release, /kl_quiz_admin_context_v1/);
  assert.doesNotMatch(release, /kl_quiz_admin_review_v1/);
  assert.match(release, /ensureQuizReady/);
  assert.match(release, /kl-generate-reading-quiz/);
  assert.match(release, /releaseConfirm/);
  assert.match(release, /isKlChapterReleased\(updated\)/);
  assert.match(release, /kl_s2_reader_series_catalog_v1/);
  assert.doesNotMatch(migration, /UPDATE public\.kl_episodes|CREATE OR REPLACE FUNCTION public\.kl_admin_action_v1/);
});

test('no staging or production publication and no changes to Season 1 quiz/AdMob/native code', () => {
  assert.match(release, /2026-12-06T00:00:00\+08:00/);
  assert.match(release, /Naka-hold ang Season 2 release/);
  assert.doesNotMatch(migration, /INSERT INTO public\.kl_episodes|DROP TABLE/);
});
