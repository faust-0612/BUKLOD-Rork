import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sceneAnchorSuggestions, validateSceneAnchor } from '../src/lib/kabihasnang-ligaw/sceneAnchorPicker.ts';

test('KL media placement only chooses exact unique saved manuscript paragraphs', () => {
  const manuscript='### KABANATA 03\n\nDito ang tamang pangungusap sa eksenang isa.\n\nIto ang ikalawang natatanging talata.';
  const options=sceneAnchorSuggestions(manuscript);
  assert.equal(options.length,2);
  assert.ok(options.every(item=>validateSceneAnchor(manuscript,item.anchor)===null));
  assert.match(validateSceneAnchor(manuscript,'Hindi ito naka-save sa manuscript'),/Wala/);
  assert.match(validateSceneAnchor(manuscript,'eksenang isa.\n\nIto ang ikalawang'),/talata/);
});

test('KL chapter approval and release require server read-back before success feedback', () => {
  const source=fs.readFileSync('src/components/kabihasnang-ligaw/KlReaderScreen.tsx','utf8');
  assert.match(source,/const loadChapterApprovalStatus = async/);
  assert.match(source,/await loadChapterApprovalStatus\(\)/);
  assert.match(source,/chapter\.status === 'approved' && Boolean\(chapter\.approved_at\)/);
  assert.match(source,/action === 'release' && !released/);
  assert.match(source,/if \(action === 'approve' && !approved\)/);
  assert.match(source,/Media approval ≠ Chapter approval ≠ Release/);
  assert.match(source,/disabled=\{Boolean\(adminBusyId\) \|\| !adminChapterStates/);
});

test('KL pending backend comment migration stays release-gated, no premature public access', () => {
  const sql=fs.readFileSync('supabase/pending/KL_READER_COMMENTS_RELEASE_GATED_R1.sql','utf8');
  assert.match(sql,/e\.status = 'approved'/);
  assert.match(sql,/e\.release_at <= now\(\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.kl_post_comment_v1/);
});

test('KL reader uses a server title, released comments endpoint and verified point totals', () => {
  const reader=fs.readFileSync('src/components/kabihasnang-ligaw/KlReaderScreen.tsx','utf8');
  const rpc=fs.readFileSync('src/lib/kabihasnang-ligaw/rpc.ts','utf8');
  assert.match(reader,/releasedTitles\[episode\.episodeNumber\]/);
  assert.match(reader,/KlLiveDiscussion episodeId=\{klDatabaseId\(selected\.episodeNumber\)\}/);
  assert.match(reader,/kl_my_story_journey_v1/);
  assert.match(rpc,/kl_reader_comments_v2/);
  assert.match(rpc,/kl_post_comment_v1/);
});
