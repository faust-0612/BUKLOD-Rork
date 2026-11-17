import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const detail = read('src/app/post/[id].tsx');
const marites = read('src/components/BuklodMaritesBoard.tsx');
const noteHook = read('src/lib/buklodConnectNoteReactions.ts');
const noteChip = read('src/components/connect/BuklodNoteReactionChip.tsx');
const connect = read('src/components/connect/ConnectQuickContacts.tsx');
const wallNotes = read('src/components/BuklodCommunityWallProfileBubbles.tsx');
const webNotes = read('src/components/BuklodCommunityConnectHeader.web.tsx');
const db = read('supabase/migrations/20261117131633_buklod_connect_note_reactions_v1.sql');

test('Marites fullscreen toggles by selected key; removing a reaction never sends null to the RPC', () => {
  const fn = marites.slice(marites.indexOf('const reactToStory = useCallback'), marites.indexOf('const removeComposerPhoto ='));
  assert.ok(fn.length > 200, 'fullscreen handler found');
  assert.match(fn, /isCommunityMaritesStory\(current\)/);
  assert.match(fn, /setMaritesStoryReaction\(\s*storyId,\s*user\.id,\s*reactionKey\s*\)/);
  assert.match(fn, /pendingStoryReactions\.current\.has\(storyId\)/);
  assert.match(fn, /pendingStoryReactions\.current\.add\(storyId\)/);
  assert.equal((fn.match(/\.finally\(\(\) => pendingStoryReactions\.current\.delete\(storyId\)\)/g) || []).length, 2);
  assert.match(fn, /my_reaction: previous/);
  assert.match(fn, /setViewStory\(\(open\)/);
  assert.match(marites, /React to story/);
});

test('Wall and fullscreen feed reactions are independent for different post ids and reconcile server result', () => {
  const fn = wall.slice(wall.indexOf('const react=async('), wall.indexOf('// PATCH_161H_INTERACTIONS'));
  assert.match(wall, /postReactBusyRef=useRef\(new Set<string>\(\)\)/);
  assert.match(fn, /postReactBusyRef\.current\.has\(postId\)/);
  assert.match(fn, /postReactBusyRef\.current\.add\(postId\)/);
  assert.match(fn, /postReactBusyRef\.current\.delete\(postId\)/);
  assert.match(fn, /data:confirmed,error/);
  assert.match(fn, /confirmed\?\?null/);
  assert.match(fn, /setFocusedPost/);
  assert.match(fn, /reportCommunityFailure/);
});

test('Post detail guards double tap, rolls back on rejection, reconciles persisted value', () => {
  const fn = detail.slice(detail.indexOf('const react=async('), detail.indexOf('const share='));
  assert.match(detail, /postReactionPendingRef=useRef\(false\)/);
  assert.match(fn, /postReactionPendingRef\.current\)return/);
  assert.match(fn, /postReactionPendingRef\.current=true/);
  assert.match(fn, /data:confirmed,error/);
  assert.match(fn, /setMyReaction\(\s*previous/);
  assert.match(fn, /confirmed\?\?null/);
  assert.match(fn, /postReactionPendingRef\.current=false/);
});

test('Notes react in Connect and Wall native/web using single shared status-note hook', () => {
  assert.match(connect, /<BuklodNoteReactionChip reaction=\{reaction\} onPress=\{onReact\}/);
  assert.match(wallNotes, /<BuklodNoteReactionChip reaction=\{reaction\} onPress=\{onReact\}/);
  assert.match(webNotes, /<BuklodNoteReactionChip reaction=\{reaction\} onPress=\{onReact\}/);
  for (const src of [connect, wallNotes, webNotes]) {
    assert.match(src, /useBuklodConnectNoteReactions/);
    assert.match(src, /toggleLove\(contact\.user_id\)/);
  }
  assert.match(noteChip, /accessibilityLabel/);
  assert.match(noteChip, /count/);
  assert.match(noteHook, /get_buklod_connect_note_reactions_v1/);
  assert.match(noteHook, /set_buklod_connect_note_reaction_v1/);
});

test('Notes reaction reads are batched, cached by signed-in account, and safely revert failed optimistic reactions', () => {
  assert.match(noteHook, /const key = `\$\{viewerId\}\|\$\{noteKey\}`/);
  assert.match(noteHook, /noteReadsInFlight\.get\(key\)/);
  assert.match(noteHook, /ownerKey\.split\(','\)/);
  assert.match(noteHook, /requestSequence\.current/);
  assert.match(noteHook, /viewerRef\.current !== viewerId/);
  assert.match(noteHook, /pending\.current\.has\(ownerId\)/);
  assert.match(noteHook, /if \(error\) throw error/);
  assert.match(noteHook, /mutate\(rows\[ownerId\] \?\? EMPTY, nextKey, previous\.my_reaction\)/);
  assert.match(noteHook, /Note reaction/);
});

test('Note reaction database has strict auth, revision expiry, self-reaction ban, and zero direct table grants', () => {
  assert.match(db, /alter table public\.buklod_connect_note_reactions enable row level security/i);
  assert.match(db, /revoke all on public\.buklod_connect_note_reactions from public, anon, authenticated/i);
  assert.match(db, /v_actor is null/);
  assert.match(db, /p_owner_id = v_actor/);
  assert.match(db, /quick_note_expires_at > now\(\)/);
  assert.match(db, /note_revision = coalesce\(s\.quick_note_expires_at, s\.updated_at\)/);
  assert.match(db, /advisory_xact_lock/);
  assert.match(db, /grant execute on function public\.get_buklod_connect_note_reactions_v1\(uuid\[\]\) to authenticated/i);
  assert.match(db, /grant execute on function public\.set_buklod_connect_note_reaction_v1\(uuid, text\) to authenticated/i);
});
