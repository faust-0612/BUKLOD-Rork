import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
test('photo comments have media-level foreign key, private table and idempotent writes', () => {
 const sql = read('supabase/migrations/20261111043000_buklod_photo_comments_by_media_v1.sql');
 assert.match(sql,/foreign key \(post_id, media_position\)[\s\S]*?references public\.community_post_media/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table public\.community_photo_comments from public, anon, authenticated/);
 assert.match(sql,/can_view_community_post_v2\(p_post_id\)/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/on conflict\(user_id,client_request_key\) do nothing/);
 assert.match(sql,/grant execute on function public\.add_buklod_photo_comment_v1[\s\S]*?to authenticated/);
 assert.doesNotMatch(sql,/grant (?:all|select|insert|update) on table public\.community_photo_comments to authenticated/i);
 assert.match(sql,/insert into public\.community_post_media/);
 assert.match(sql,/on conflict \(post_id, media_position\) do nothing/);
 assert.match(sql,/get_buklod_photo_comment_counts_v1/);
 assert.match(sql,/revoke all on function public\.get_buklod_photo_comment_counts_v1/);
});
test('per-photo UI reads actual counts and writes scoped comments', () => {
 const wall=read('src/app/(tabs)/buklod.tsx');
 const sheet=read('src/components/BuklodPhotoCommentsSheet.tsx');
 assert.match(wall,/get_buklod_photo_comment_counts_v1/);
 assert.match(sheet,/get_buklod_photo_comment_summary_v1/);
 assert.match(wall,/Photo comments/);
 assert.match(wall,/BuklodPhotoCommentsSheet/);
 assert.match(sheet,/add_buklod_photo_comment_v1/);
 assert.match(sheet,/p_media_position: mediaPosition/);
 assert.match(sheet,/p_request_key: key/);
 assert.match(sheet,/pendingKey\.current/);
 assert.match(sheet,/request !== sequence\.current/);
 assert.doesNotMatch(sheet,/set_buklod_post_reaction_v3|add_buklod_post_comment_v4/);
});
test('post-level comment action retains its visible numeric count', () => {
 assert.match(read('src/components/BuklodCommunityPostEngagement.tsx'),/Comment ' \+ totalComments/);
});
