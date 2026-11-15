import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('children story routes and discoverability integrate with existing BUKLOD Home without replacing other doors',()=>{
  const home=file('src/components/home/BuklodHomeUtilityCards.tsx');
  const layout=file('src/app/_layout.tsx');
  const nav=file('src/lib/buklodNavigationV2.ts');
  assert.match(home,/Children's Story World/);
  assert.match(home,/router\.push\('\/children-stories'/);
  assert.match(home,/Online Consultation/);
  assert.match(home,/My BUKLOD Home/);
  assert.match(layout,/children-stories\/index/);
  assert.match(layout,/children-stories\/\[id\]/);
  assert.match(nav,/id: 'stories'.*route: '\/children-stories'/);
});
test('child-directed screens block all generic ads without disturbing unrelated ad rules',()=>{
  const source=file('src/lib/buklodGlobalAdController.ts');
  const bridge=file('src/components/BuklodAdSafetyRouteBridge.tsx');
  assert.match(source,/SENSITIVE_PREFIXES[\s\S]*'\/children-stories'/);
  assert.match(bridge,/if \(!isBuklodAdRouteSensitive\(\)\)/);
});
test('editorial writes require authenticated system admin via RLS; no child personal data table',()=>{
  const sql=file('supabase/migrations/20261115090000_buklod_children_stories_v1.sql');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on public\.buklod_children_stories from public, anon, authenticated/i);
  assert.match(sql,/for insert to authenticated[\s\S]*is_system_admin\(\)/i);
  assert.match(sql,/for update to authenticated[\s\S]*is_system_admin\(\)/i);
  assert.doesNotMatch(sql,/child_name|birth_date|child_user_id|ad_identifier/i);
});
test('story reader has narrated playback cleanup, quiz and adult-account local progress',()=>{
  const reader=file('src/app/children-stories/[id].tsx');
  const service=file('src/features/childrenStories/service.ts');
  assert.match(reader,/AppState\.addEventListener/);
  assert.match(reader,/Speech\.stop/);
  assert.match(reader,/StoryArt/);
  assert.match(reader,/saveStoryProgress/);
  assert.match(service,/children-stories\/v1\/\$\{uid\}/);
});
