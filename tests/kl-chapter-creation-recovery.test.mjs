import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { klPublishingErrorMessage } from '../src/lib/kabihasnang-ligaw/publishingErrors.ts';

test('PostgREST plain object errors are visible rather than generic failures', () => {
  assert.match(klPublishingErrorMessage({ code: '23502', message: 'null id' }), /KL-23502/);
  assert.match(klPublishingErrorMessage({ code: '42501', message: 'Admin only' }), /permission/);
  assert.match(klPublishingErrorMessage({ message: 'Network request failed' }), /connection/);
  assert.match(klPublishingErrorMessage({ code: '504', message: 'Gateway Timeout' }), /server/);
  assert.equal(klPublishingErrorMessage({ code: 'PGRST202', message: 'RPC not found' }), 'RPC not found (PGRST202)');
  assert.match(klPublishingErrorMessage(null), /Subukan muli/);
});

test('KL creation uses the UUID-default schema migration without changing approval semantics', () => {
  const sql = readFileSync('supabase/migrations/20261101233257_kl_episode_uuid_default_recovery_20261102.sql', 'utf8');
  assert.match(sql, /ALTER TABLE public\.kl_episodes\s+ALTER COLUMN id SET DEFAULT gen_random_uuid\(\)/i);
  assert.doesNotMatch(sql, /\bUPDATE\b|\bDELETE\b|\bDROP\b|\bREVOKE\b/i);
  const studio = readFileSync('src/components/kabihasnang-ligaw/KlPublishingStudio.tsx', 'utf8');
  assert.match(studio, /klPublishingErrorMessage\(error\)/);
  assert.match(studio, /await refresh\(\)\.catch\(\(\) => undefined\)/);
  assert.match(studio, /supabase\.rpc\('kl_admin_create_chapter_v1'/);
});
