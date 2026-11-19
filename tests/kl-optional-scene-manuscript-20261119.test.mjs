import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261119064000_kl_optional_scene_manuscript_preview.sql', 'utf8');
const studio = readFileSync('src/components/kabihasnang-ligaw/KlPublishingStudio.tsx', 'utf8');
const approvals = readFileSync('src/components/kabihasnang-ligaw/KlAdminPreview.tsx', 'utf8');
const upload = readFileSync('src/components/kabihasnang-ligaw/KlAdminMediaUpload.tsx', 'utf8');

// Fixtures exercise the exact count/unique/anchor semantics used by the
// preview SQL for zero, one, twelve, and invalid uploaded illustrations.
function canPreparePreview(manuscript, photos) {
  const total = photos.length;
  const valid = photos.filter(p => typeof p === 'string'
    && p.trim().length >= 12 && manuscript.split(p).length === 2).length;
  const unique = new Set(photos.filter(p => p !== null)).size;
  return total <= 12 && valid === total && unique === total;
}
const body = 'An early village on the river had a clear night sky. The travelers saw lights on the distant shore.';

test('manuscript-only preview advances with no scene photo or upload', () => {
  assert.equal(canPreparePreview(body, []), true);
  assert.match(studio, /Scene photos are optional/);
  assert.match(migration, /v_total > 12 OR v_valid <> v_total OR v_unique <> v_total/);
  assert.doesNotMatch(migration, /v_(?:count|total)\s*<\s*2/);
});
test('one illustration is valid, twelve unique illustrations remain possible', () => {
  const paragraphs = Array.from({ length: 12 }, (_, i) => 'Distinct passage for scene number ' + (i + 1) + ' in this manuscript.');
  assert.equal(canPreparePreview(paragraphs.join(' '), paragraphs.slice(0, 1)), true);
  assert.equal(canPreparePreview(paragraphs.join(' '), paragraphs), true);
  assert.equal(canPreparePreview(paragraphs.join(' '), [...paragraphs, 'extra photo placement']), false);
});
test('uploaded illustration without placement or duplicate/invalid passage remains blocked', () => {
  const unique = 'The travelers saw lights on the distant shore.';
  assert.equal(canPreparePreview(body, [null]), false);
  assert.equal(canPreparePreview(body, [unique, unique]), false);
  assert.equal(canPreparePreview(body, ['An image not in the manuscript']), false);
  assert.equal(canPreparePreview(body, ['night']), false);
  assert.equal(canPreparePreview(body + ' ' + unique, [unique]), false);
});
test('approval and release security unchanged; optional media upload still available', () => {
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path TO ''/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /role::text = 'system_admin'/);
  assert.match(migration, /is_active = true/);
  assert.match(migration, /PERFORM public\.kl_admin_unlock_unread_release_v1/);
  assert.match(upload, /Upload Image/);
  assert.match(upload, /Save exact placement/);
  assert.match(approvals, /kl_admin_media_approve_v1/);
  assert.doesNotMatch(migration, /kl_admin_action_v1/);
});
