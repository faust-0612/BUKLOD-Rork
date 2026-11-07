import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file,'utf8');
const home = read('src/app/(tabs)/home.tsx');
const qmp = read('src/components/BuklodCommunityContributionCard.tsx');
const wall = read('src/app/(tabs)/buklod.tsx');
const scope = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const overflow = read('src/components/BuklodContentOverflowMenu.tsx');
const marites = read('src/components/BuklodMaritesBoard.tsx');

test('Home visibly renders the private Contribution card ahead of long bulletins, Wall remains locked',()=>{
  const qmpPos=home.indexOf('<BuklodCommunityContributionCard />');
  assert.equal((home.match(/<BuklodCommunityContributionCard \/>/g)||[]).length,1);
  assert.ok(qmpPos > home.indexOf('<EnvironmentBadge />'));
  assert.ok(qmpPos < home.indexOf('<BuklodSystemAnnouncementBoard'));
  assert.ok(qmpPos < home.indexOf('<BuklodHomeScopeBulletins />'));
  assert.doesNotMatch(wall, /<BuklodCommunityContributionCard\s*\/>/);
  assert.match(qmp, /YOUR COMMUNITY CONTRIBUTION/);
  assert.match(qmp, /Unable to load right now · tap to retry/);
  assert.match(qmp, /setData\(null\); \/\/ Never reuse another account's financial preview/);
  assert.match(qmp, /loadMyCommunityContribution\(\)/);
  assert.match(qmp, /NOT WITHDRAWABLE/);
});

test('Public and scoped Wall preview big letters during writing, not only after publication',()=>{
  assert.match(wall, /const largeComposerText = !photos\.length && !wallVideo186O && !communityGif/);
  assert.match(scope, /const largeScopedText = mode === 'wall' && !photos\.length && !wallVideo && !communityGif/);
  assert.match(wall, /fontSize:25, lineHeight:33, fontWeight:'800'/);
  assert.match(scope, /fontSize:25, lineHeight:33, fontWeight:'800'/);
  assert.match(wall, /Large text · this post will appear in big letters/);
  assert.match(scope, /Large text · big letters after publishing/);
  assert.match(read('src/components/BuklodExpandableWallCaption.tsx'), /const LARGE_TEXT_LIMIT = 80/);
});

test('Posting collapses composer immediately with persistent nonblocking feedback and safe failure recovery',()=>{
  assert.match(wall, /setCommunityComposerOpen\(false\); \/\/ Return to compact posting bar immediately/);
  assert.match(scope, /setWallComposerOpen\(false\)/);
  assert.match(wall, /\(publishNotice \|\| postFeedback\) &&/);
  assert.match(scope, /\(publishNotice \|\| scopedPostFeedback\) &&/);
  assert.match(wall, /setPostFeedback\('Posted to Community'\)/);
  assert.match(scope, /setScopedPostFeedback\('Posted to this Community'\)/);
  assert.match(wall, /postingSubmissionRef\.current/);
  assert.match(scope, /postingSubmissionRef\.current/);
  assert.match(scope, /createAttempted/); // keep timeout/duplicate protection
  assert.match(wall, /setBody\(current => current\.trim\(\) \? current : snapshot\.body\)/);
  assert.match(scope, /setBody\(current => current\.trim\(\) \? current : snapshot\.cleanBody\)/);
});

test('Overflow sheet has explicit Cancel, outside-tap and Android Back dismissal, no truncated Alert menu',()=>{
  assert.match(overflow, /const \[menuOpen, setMenuOpen\] = useState\(false\)/);
  assert.match(overflow, /visible=\{menuOpen\}/);
  assert.match(overflow, /onRequestClose=\{closeMenu\}/);
  assert.match(overflow, /accessibilityLabel="Dismiss post options"/);
  assert.match(overflow, /accessibilityLabel="Cancel post options"/);
  assert.match(overflow, /onPress=\{event => event\.stopPropagation\(\)\}/);
  assert.match(overflow, /runMenuAction\(confirmDelete\)/);
  assert.match(overflow, /style: 'destructive'/); // deletion confirmation still required
  assert.doesNotMatch(overflow, /Alert\.alert\(title, undefined, actions\)/);
});

test('Marites photo and video fill all card height, keeping author metadata legible over media',()=>{
  assert.match(marites, /storyPhotoFill:\s*\{[\s\S]*?bottom: 0,/);
  assert.match(marites, /height=\{MARITES_COMPACT_CARD_HEIGHT\}/);
  assert.match(marites, /const hasMedia = hasPhoto \|\| hasVideo/);
  assert.match(marites, /hasMedia && styles\.authorFooterOnPhoto/);
  assert.match(marites, /backgroundColor: 'rgba\(8, 16, 12, 0\.16\)'/);
  assert.match(marites, /textShadowRadius: 3/);
});
