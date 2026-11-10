import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wall = readFileSync('src/app/(tabs)/buklod.tsx','utf8');
const engagement = readFileSync('src/components/BuklodCommunityPostEngagement.tsx','utf8');
const collage = readFileSync('src/components/BuklodCommunityPhotoCollage.tsx','utf8');
const migration = readFileSync('supabase/migrations/20261111023600_community_photo_comments_v1.sql','utf8');

test('Wall always exposes the total number of post comments', () => {
 assert.match(engagement,/\{socialActions \? \(/);
 assert.match(engagement,/visibleCommentCountText/);
 assert.match(engagement,/totalComments === 1 \? 'comment' : 'comments'/);
 assert.match(engagement,/onPress=\{onOpenComments\}/);
 assert.match(engagement,/socialActions \? 'Comment' : totalComments/);
});

test('Collage preserves photo identity across every swipe', () => {
 assert.match(collage,/post_id\?: string \| null/);
 assert.match(collage,/media_position\?: number \| null/);
 assert.match(collage,/photo_comment_count\?: number \| null/);
 assert.match(wall,/post_id:item\?\.id/); // legacy single-photo fallback
 assert.match(wall,/media_position:0/);
 assert.match(wall,/viewerItems\[viewerIndex\]/);
});

test('Photo comments are scoped by both post and media position', () => {
 assert.match(wall,/commentPhotoPositionRef\.current/);
 assert.match(wall,/get_buklod_photo_comments_v1/);
 assert.match(wall,/add_buklod_photo_comment_v1/);
 assert.match(wall,/p_media_position:targetPhotoPosition/);
 assert.match(wall,/':photo:'\+photoPosition/);
 assert.match(wall,/':photo:'\+targetPhotoPosition/);
 assert.match(wall,/commentPhotoPositionRef\.current===photoPosition/);
 assert.match(wall,/commentPhotoPositionRef\.current===targetPhotoPosition/);
 assert.match(wall,/Photo \$\{commentPhotoPosition\+1\} comments/);
});

test('Photo comment counters are batched and reject stale responses', () => {
 assert.match(wall,/get_buklod_photo_comment_counts_v1/);
 assert.match(wall,/requestId!==photoCountsRequestRef\.current/);
 assert.match(wall,/viewerPhotoPostIdRef\.current!==postId/);
 assert.match(wall,/setViewerItems\(current=>current\.map\(photo=>/);
 assert.match(wall,/photo\.photo_comment_count===1\?'comment':'comments'/);
 assert.match(wall,/void refreshViewerPhotoCommentCounts\(postId\)/);
 assert.match(wall,/void refreshViewerPhotoCommentCounts\(String\(commentPost\.id\)\)/);
});

test('Database migration keeps photo discussions in canonical moderation and scoped by audience', () => {
 assert.match(migration,/alter table public\.comments[\s\S]*add column if not exists media_position smallint/);
 assert.match(migration,/insert into public\.comments\(post_id,user_id,body,parent_id,media_position\)/);
 assert.match(migration,/public\.can_view_community_post_v2\(p_post_id\)/);
 assert.match(migration,/parent\.media_position = p_media_position/);
 assert.match(migration,/c\.is_hidden = false/);
 assert.match(migration,/c\.deleted_at is null/);
 assert.match(migration,/revoke all on function public\.add_buklod_photo_comment_v1/);
 assert.match(migration,/grant execute on function public\.get_buklod_photo_comments_v1/);
 assert.doesNotMatch(migration,/grant\s+.*\s+to\s+anon\b/i);
});

test('Legacy photo reaction backfill is metadata-only and idempotent', () => {
 assert.match(migration,/insert into public\.community_post_media/);
 assert.match(migration,/and not exists \(/);
 assert.match(migration,/on conflict \(post_id, media_position\) do nothing/);
 assert.doesNotMatch(migration,/storage\.objects|delete from|truncate table/i);
});
