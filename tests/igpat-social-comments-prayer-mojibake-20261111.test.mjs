import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const post = read('src/app/post/[id].tsx');
const prayer = read('src/app/prayer/[id].tsx');
const igpatAndroid = read('src/app/igpat/index.tsx');
const igpatWeb = read('src/app/igpat/index.web.tsx');

test('IGPAT comments navigate straight to the compact comment thread on both platforms', () => {
  assert.match(igpatAndroid, /\/post\/\$\{item\.id\}\?openComments=1/);
  assert.match(igpatWeb, /\/post\/\$\{item\.id\}\?openComments=1/);
  assert.match(post, /openComments==='1'/);
  assert.match(post, /commentsStartYRef\.current/);
  assert.match(post, /focusCommentId===String\(c\.id\)/);
});

test('compact comment rows preserve avatar, readable bubble, reply, report and mentions', () => {
  assert.match(post, /I(GPAT|GPAT) \/ Community: lightweight social comments/);
  assert.match(post, /<BuklodTappableAvatar userId=\{c\.user_id\}/);
  assert.match(post, /style=\{s\.commentBubble\}/);
  assert.match(post, /style=\{s\.commentActions\}/);
  assert.match(post, /setReplyTo\(c\)/);
  assert.match(post, /openReport\('comment',String\(c\.id\)\)/);
  assert.match(post, /<BuklodMentionText/);
  assert.doesNotMatch(post, /POST COMMENT/);
});

test('sticky composer disables empty and in-flight sends while existing RPC and ad cadence stay intact', () => {
  assert.match(post, /if\(busy \|\| !comment\.trim\(\)\)return/);
  assert.match(post, /disabled=\{busy\|\|!comment\.trim\(\)\}/);
  assert.match(post, /get_buklod_post_comments_v4/);
  assert.match(post, /add_buklod_post_comment_v4/);
  assert.match(post, /p_parent_id:/);
  assert.match(post, /setReplyTo\(null\)/);
  assert.match(post, /recordConfirmedCommunityComment/);
  assert.match(post, /BuklodFirstViewAd/);
  assert.match(post, /BuklodPostInternalShare/);
});

test('prayer detail has no double-encoded control labels and retains recording/reporting', () => {
  assert.doesNotMatch(prayer, /â(?:–|š|œ)/u);
  assert.match(prayer, /' ▲'/);
  assert.match(prayer, /' ▼'/);
  assert.match(prayer, /title="REPORT CONTENT"/);
  assert.match(prayer, /MARK AS ANSWERED/);
  assert.match(prayer, /get_prayer_responder_names_v2/);
  assert.match(prayer, /prayer_responses/);
  assert.match(prayer, /moderation\/report/);
});
