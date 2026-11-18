import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('rank is canonical and missing RPC does not invent Starter V',()=>{
  const sql=read('supabase/migrations/20261118223000_buklod_rank_sync_permanent_notes_hotfix.sql');
  assert.ok(sql.includes('get_member_circle_ranks_v1'));
  assert.ok(!sql.includes('is_verified'));
  assert.ok(sql.includes('buklod_is_platform_official_v1'));
  const wall=read('src/app/(tabs)/buklod.tsx');
  assert.ok(wall.includes('author_rank_name: rankMap.get(p.user_id) ?? null'));
  assert.ok(wall.includes("item.author_rank_name || 'Rank updating'"));
});
test('Notes never expire on server or in warm client caches',()=>{
  const sql=read('supabase/migrations/20261118223000_buklod_rank_sync_permanent_notes_hotfix.sql');
  assert.ok(sql.includes('create trigger buklod_profile_note_permanent_v1'));
  assert.ok(sql.includes('new.quick_note_expires_at := null'));
  assert.ok(!sql.includes("interval '24 hours'"));
  assert.ok(read('src/lib/buklodMessagesStatusNote.ts').includes('expires_at: null'));
  assert.ok(read('src/app/profile/status.tsx').includes('quick_note_expires_at: null'));
  assert.ok(!read('src/components/ProfileAvatar.tsx').includes('quick_note_expires_at'));
});
test('Contact notes clear on successful deletion, survive temporary failed fetches',()=>{
  const src=read('src/lib/buklodConnectSuggestedContacts.ts');
  assert.ok(src.includes('if (!noteByUser) return contacts'));
  assert.ok(src.includes('quick_note: noteByUser.get(contact.user_id) ?? null'));
});
