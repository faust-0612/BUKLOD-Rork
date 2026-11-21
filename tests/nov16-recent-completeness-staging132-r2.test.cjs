const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const root = join(__dirname, '..');
const read = p => readFileSync(join(root,p),'utf8');

test('Home relocation, 132-story library and Matthew Henry v4 survive Wall/Connect backport', () => {
  const home=read('src/app/(tabs)/hub.tsx');
  const family=read('src/app/profile/buklod-family.tsx');
  const today=read('src/components/BuklodTodayCard.tsx');
  const henry=read('src/lib/buklodHenryTranslation.ts');
  const stories=read('src/features/childrenStories/inStoryDialogue.ts');
  assert.doesNotMatch(home,/BuklodKingdomHubCard/);
  assert.match(family,/router\.push\('\/personal-home'/);
  assert.match(today,/Magbahagi ng Dugtong/);
  assert.match(today,/react_to_buklod_today_tip_v2/);
  assert.match(henry,/henry-translation-v4/);
  assert.match(stories,/dialogue/i);
});

test('Notes render with adequate space on Wall and Connect without removing themed scoped captions', () => {
  const scoped=read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const wall=read('src/app/(tabs)/buklod.tsx');
  const detail=read('src/app/post/[id].tsx');
  const bubbles=read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  const connect=read('src/components/connect/ConnectQuickContacts.tsx');
  const avatars=read('src/components/ProfileAvatar.tsx');
  assert.equal((scoped.match(/<ProfileAvatarNoteChip userId=\{item\.user_id\} \/>/g)||[]).length,2);
  assert.match(scoped,/style=\{\[styles\.author, \{ color: theme\.textPrimary \}\]\}/);
  assert.match(scoped,/text=\{repairMojibakeText\(item\.body\)\}/);
  assert.match(wall,/ProfileAvatarNoteChip/);
  assert.match(detail,/createPostDetailStyles\(theme\)/);
  assert.match(avatars,/export function ProfileAvatarNoteChip/);
  assert.doesNotMatch(avatars,/quick_note_expires_at/);
  assert.match(bubbles,/const NOTE_MAX_LINES = 5/);
  assert.match(connect,/const NOTE_MAX_LINES = 5/);
});

test('Locked avatar remains visible without disabling the private member content gate',()=>{
  const member=read('src/app/member/[id].tsx');
  const guard=read('src/components/BuklodFocusAppRouteGuard.tsx');
  assert.match(member,/profile\?\.is_locked \|\| !profile\?\.can_view_details/);
  assert.match(member,/profile \? <ProfileAvatar userId=\{profile\.user_id\}/);
  assert.match(guard,/focusAppForPathname\(pathname\)/);
});

test('No changes to production channels, AdMob controller or navigation policies in this scoped release',()=>{
  const release=JSON.parse(read('.buklod/scopes/nov16-all-pending-home-focus-stories-henry-v4.json'));
  assert.equal(release.baseRef,'main');
  assert.ok(release.lockedFeatureChanges.some(x=>x.id==='wall-media'));
  for(const changed of release.allowedPaths) {
    assert.doesNotMatch(changed,/adController|AdMob|app\.config|android\//i);
  }
});
