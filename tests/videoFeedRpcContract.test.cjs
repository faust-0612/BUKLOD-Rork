const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const sql=fs.readFileSync(path.join(__dirname,
  '../supabase/migrations/20261027041444_community_video_keyset_fair_discovery_v1.sql'), 'utf8');

test('video-only keyset RPC guards public eligibility and author identity',()=>{
  for(const required of [
    'get_buklod_public_community_video_page_v1',
    'security definer',
    "cp.audience = 'public'",
    'cp.scope_id is null',
    'cp.deleted_at is null',
    'cp.is_hidden = false',
    "coalesce(cp.author_only, false) = false",
    "coalesce(meta.moderation_state, 'approved') <> 'blocked'",
    "p.post_privacy = 'anonymous'",
    "Anonymous BUKLOD Member",
    'position(U&',
    'marites-',
    '(cp.created_at, cp.id) < (p_cursor_created_at, p_cursor_id)',
    'limit least(greatest(coalesce(p_limit, 15), 1), 20)',
    'from public, anon',
    'to authenticated',
  ]) assert.ok(sql.includes(required),`Missing guard: ${required}`);
});

test('video-only query does not write impressions, points, or files',()=>{
  assert.doesNotMatch(sql,/\b(insert|update|delete|truncate|drop table)\b/i);
});
